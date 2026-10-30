// Strava: conectar a conta, enviar atividades automaticamente e importar corridas.
// Toda conversa com o Strava passa pela função "strava" no Supabase, que guarda a chave secreta.
import { S, put } from './store.js';
import { CLOUD } from './cloud-config.js';
import { accessToken } from './cloud.js';
import { pendingItemFor } from './schedule.js';
import { latestWeight } from './analysis.js';
import { esc, pad, fmtNum, fmtPace, runKcal, toast } from './util.js';

const STATUS_KEY = 'strava-status', PREFS_KEY = 'strava-prefs', IMPORT_KEY = 'strava-last-import';
const RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun'];
const CARDIO_SPORT = { esteira: 'Run', bike: 'Ride', bike_rua: 'Ride', eliptico: 'Elliptical', escada: 'StairStepper', caminhada: 'Walk', corrida: 'Run', outro: 'Workout' };
const CARDIO_NAME = { esteira: 'Esteira', bike: 'Bicicleta ergométrica', bike_rua: 'Bicicleta', eliptico: 'Elíptico', escada: 'Escada', caminhada: 'Caminhada', corrida: 'Corrida', outro: 'Cardio' };
const INDOOR = ['esteira', 'bike', 'eliptico', 'escada'];

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
export const cachedStatus = () => read(STATUS_KEY, null);
export const connected = () => !!cachedStatus()?.connected;
export const prefs = () => ({ runs: true, cardio: true, strength: false, ...read(PREFS_KEY, {}) });
export const setPrefs = p => localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs(), ...p }));
export const activityUrl = id => `https://www.strava.com/activities/${id}`;
const redirectUri = () => `${location.origin}${location.pathname}`;

async function call(action, payload = {}, auth = true) {
  if (!CLOUD.url) throw new Error('A nuvem não está configurada.');
  const headers = { 'Content-Type': 'application/json', apikey: CLOUD.key };
  if (auth) {
    const t = await accessToken();
    if (!t) throw new Error('Entre na sua conta da nuvem (Perfil → Nuvem) para usar o Strava.');
    headers.Authorization = `Bearer ${t}`;
  }
  let r;
  try { r = await fetch(`${CLOUD.url}/functions/v1/strava`, { method: 'POST', headers, body: JSON.stringify({ action, ...payload }) }); }
  catch { throw new Error('Sem conexão com a internet.'); }
  const b = await r.json().catch(() => ({}));
  if (r.status === 404) throw new Error('A função "strava" ainda não foi publicada no Supabase.');
  if (!r.ok) throw new Error(b.error || b.message || `Erro ${r.status} na conexão com o Strava`);
  return b;
}

/* ---------- conexão ---------- */

export async function connect() {
  const { url } = await call('start', { redirect: redirectUri() });
  location.href = url;
}

export async function refreshStatus() {
  const s = await call('status');
  localStorage.setItem(STATUS_KEY, JSON.stringify(s));
  return s;
}

export async function disconnect() {
  await call('disconnect');
  localStorage.setItem(STATUS_KEY, JSON.stringify({ connected: false }));
}

// O Strava volta para o app com ?code=...&state=... depois da autorização
export async function handleCallback() {
  const q = new URLSearchParams(location.search);
  if (!q.has('state') || !(q.has('code') || q.has('error'))) return null;
  history.replaceState(null, '', location.pathname + (location.hash || '#/perfil'));
  if (q.get('error')) return { ok: false, msg: 'A conexão com o Strava foi cancelada.' };
  try {
    const r = await call('exchange', { code: q.get('code'), state: q.get('state') }, false);
    localStorage.setItem(STATUS_KEY, JSON.stringify({ connected: true, athlete: r.athlete }));
    const canWrite = (q.get('scope') || '').includes('activity:write');
    return { ok: true, athlete: r.athlete, canWrite };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

/* ---------- envio de atividades ---------- */

const startMs = s => s.startEpoch || s.startedAt || Date.parse(`${s.date}T07:00:00`);
const isoLocal = ms => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

function gpx(s, name) {
  const t0 = startMs(s), segs = [];
  let cur = [];
  for (const p of s.route) {
    if (p[3] && cur.length) { segs.push(cur); cur = []; }
    cur.push(`<trkpt lat="${p[0]}" lon="${p[1]}"><time>${new Date(t0 + (p[2] || 0)).toISOString()}</time></trkpt>`);
  }
  if (cur.length) segs.push(cur);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Olimpo" xmlns="http://www.topografix.com/GPX/1/1"><metadata><time>${new Date(t0).toISOString()}</time></metadata>`
    + `<trk><name>${esc(name)}</name><type>running</type>${segs.map(x => `<trkseg>${x.join('')}</trkseg>`).join('')}</trk></gpx>`;
}

export function activityFor(s) {
  const base = { start_date_local: isoLocal(startMs(s)), elapsed_time: s.durationSec || 0 };
  if (s.kind === 'run') {
    const name = `${S.templates.run[s.runType]?.name || 'Corrida'} · Olimpo`;
    const description = [
      `${fmtNum(s.distanceKm, 2)} km · ritmo ${fmtPace(s.avgPaceSec)}/km`,
      s.splits?.length ? `Parciais: ${s.splits.map(x => fmtPace(x.sec)).join(', ')}` : '',
      s.intervals?.length ? `${s.intervals.length} tiros` : '',
      s.notes || '', 'Registrado no app Olimpo',
    ].filter(Boolean).join('\n');
    if (s.route?.length > 10 && s.modality !== 'esteira') return { name, description, sport_type: 'Run', gpx: gpx(s, name), external_id: `olimpo-${s.id}` };
    return { ...base, name, description, sport_type: 'Run', distance: (s.distanceKm || 0) * 1000, trainer: s.modality === 'esteira' };
  }
  if (s.kind === 'cardio') {
    const t = s.cardioType;
    return { ...base, name: `${CARDIO_NAME[t] || 'Cardio'} · Olimpo`, sport_type: CARDIO_SPORT[t] || 'Workout', distance: (s.distanceKm || 0) * 1000, trainer: INDOOR.includes(t),
      description: [s.resistance ? `Resistência nível ${s.resistance}` : '', s.incline ? `Inclinação ${s.incline}%` : '', s.notes || '', 'Registrado no app Olimpo'].filter(Boolean).join('\n') };
  }
  if (s.kind === 'strength') {
    const tpl = S.templates.strength[s.ref];
    const lines = (s.exercises || []).filter(e => e.sets.some(x => x.done))
      .map(e => `${e.name}: ${e.sets.filter(x => x.done).map(x => `${fmtNum(x.load || 0, 1).replace(',0', '')}${e.unit === 's' ? '' : 'kg'}×${x.reps}${e.unit === 's' ? 's' : ''}`).join(', ')}`);
    return { ...base, name: `${tpl?.name || 'Musculação'}${tpl?.groups ? ` (${tpl.groups})` : ''} · Olimpo`, sport_type: 'WeightTraining', description: [...lines, 'Registrado no app Olimpo'].join('\n') };
  }
  return null;
}

export async function sendToStrava(s) {
  const a = activityFor(s);
  if (!a) throw new Error('Este registro não pode ser enviado ao Strava.');
  const r = await call('upload', { activity: a });
  s.strava = { activityId: r.activityId || null, uploadId: r.uploadId || null, sentAt: Date.now() };
  await put('sessions', s);
  return r;
}

// Chamado ao salvar uma corrida, cardio ou musculação
export async function autoSend(s) {
  if (!s || !connected() || s.source === 'strava' || s.strava?.activityId) return;
  const p = prefs();
  if (!((s.kind === 'run' && p.runs) || (s.kind === 'cardio' && p.cardio) || (s.kind === 'strength' && p.strength))) return;
  try { await sendToStrava(s); toast('Enviado ao Strava ✓'); }
  catch (e) { toast(`Strava: ${e.message}`); }
}

/* ---------- importação de corridas ---------- */

function decodePolyline(str) {
  let i = 0, lat = 0, lng = 0;
  const out = [];
  while (i < str.length) {
    for (let k = 0; k < 2; k++) {
      let b, shift = 0, res = 0;
      do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = res & 1 ? ~(res >> 1) : res >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    out.push([+(lat / 1e5).toFixed(6), +(lng / 1e5).toFixed(6), 0]);
  }
  if (out.length) out[0][3] = 1;
  return out;
}

export async function importRuns() {
  const last = +localStorage.getItem(IMPORT_KEY) || 0;
  const after = last ? Math.floor(last / 1000) - 86400 : Math.floor(Date.now() / 1000) - 30 * 86400;
  const { activities } = await call('list', { after });
  const have = new Set(S.sessions.map(s => s.strava?.activityId).filter(Boolean));
  let n = 0;
  for (const a of activities) {
    if (!RUN_TYPES.includes(a.sport_type) || have.has(a.id) || String(a.external_id || '').startsWith('olimpo-')) continue;
    const date = a.start_date_local.slice(0, 10);
    const km = (a.distance || 0) / 1000, sec = a.moving_time || a.elapsed_time || 0;
    if (km <= 0 || sec <= 0) continue;
    const runType = a.workout_type === 3 ? 'B' : 'A';
    await put('sessions', {
      kind: 'run', date, planDate: pendingItemFor('run', date)?.origin || null, runType, ref: runType,
      modality: a.trainer || a.sport_type === 'VirtualRun' ? 'esteira' : a.sport_type === 'TrailRun' ? 'parque' : 'rua',
      startEpoch: Date.parse(a.start_date), distanceKm: +km.toFixed(3), durationSec: sec,
      avgPaceSec: sec / km, avgSpeed: km / (sec / 3600), bestPaceSec: sec / km,
      hrAvg: a.average_heartrate ? Math.round(a.average_heartrate) : null, hrMax: a.max_heartrate || null,
      kcal: Math.round(runKcal(latestWeight(date) || 70, km)), splits: [], laps: [], intervals: [],
      route: a.polyline ? decodePolyline(a.polyline) : [], source: 'strava', notes: a.name,
      strava: { activityId: a.id, imported: true },
    });
    n++;
  }
  localStorage.setItem(IMPORT_KEY, String(Date.now()));
  return n;
}
