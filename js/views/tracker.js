// Cronômetro e monitoramento da corrida: GPS, parciais por km, voltas, tiros e frequência cardíaca.
// O estado ao vivo é salvo continuamente no aparelho; se a página recarregar, a corrida continua.
import { S, put } from '../store.js';
import { todayISO, fmtDur, fmtPace, fmtNum, fmtInt, haversine, runKcal, metKcal, toast, num, esc } from '../util.js';
import { pendingItemFor } from '../schedule.js';
import { latestWeight } from '../analysis.js';
import { $, chips, bindChips, chipVal } from '../ui.js';
import { MODALITIES } from '../defaults.js';
import { autoSend } from '../strava.js';

const KEY = 'run-live-v1';
let T = null;
let watchId = null, wakeLock = null, hrChar = null, tickTimer = null, ticks = 0, root = null;

const loadLive = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const persist = () => { if (T) localStorage.setItem(KEY, JSON.stringify(T)); };
const elapsed = () => T.accMs + (T.status === 'running' ? Date.now() - T.segStart : 0);
const usesGps = () => T.gps && T.modality !== 'esteira';

export function isLive() {
  if (!T) T = loadLive();
  return !!T && (T.status === 'running' || T.status === 'paused');
}
export function liveSummary() {
  return isLive() ? `${T.status === 'paused' ? 'Pausada' : 'Em andamento'} · ${fmtDur(elapsed() / 1000)} · ${fmtNum(T.distM / 1000, 2)} km` : '';
}

function newState(p) {
  return {
    status: 'setup', type: p.tipo === 'B' ? 'B' : 'A', modality: p.modalidade || 'rua', planDate: p.plan || null,
    gps: true, accMs: 0, segStart: 0, startEpoch: 0, date: null,
    distM: 0, lastDistT: 0, lastFix: null, gpsAcc: null, route: [], splits: [], laps: [], intervals: [],
    phase: null, phaseStartMs: 0, recent: [], hr: [], hrNow: null, lastHrT: -1e9,
  };
}

/* ---------- distância, parciais e ritmo ---------- */

function addDistance(newDistM, tMs) {
  const prevD = T.distM, prevT = T.lastDistT;
  T.distM = newDistM;
  while (T.distM >= (T.splits.length + 1) * 1000) {
    const target = (T.splits.length + 1) * 1000;
    const f = (target - prevD) / ((newDistM - prevD) || 1);
    const tc = prevT + Math.max(0, Math.min(1, f)) * (tMs - prevT);
    const prevCum = T.splits.at(-1)?.cumMs || 0;
    T.splits.push({ km: T.splits.length + 1, sec: (tc - prevCum) / 1000, cumMs: tc });
  }
  T.lastDistT = tMs;
  T.recent.push([tMs, T.distM]);
  while (T.recent.length > 2 && tMs - T.recent[1][0] > 30000) T.recent.shift();
}

function currentPace() {
  const r = T.recent;
  if (r.length < 2 || elapsed() - r.at(-1)[0] > 20000) return null;
  const dd = r.at(-1)[1] - r[0][1], dt = (r.at(-1)[0] - r[0][0]) / 1000;
  return dd > 15 ? dt / (dd / 1000) : null;
}

function onFix(pos) {
  if (!T || T.status !== 'running') return;
  const { latitude, longitude, accuracy } = pos.coords;
  T.gpsAcc = Math.round(accuracy);
  if (accuracy > 35) return;
  const t = elapsed();
  const p = [+latitude.toFixed(6), +longitude.toFixed(6), Math.round(t)];
  if (!T.lastFix) { T.lastFix = p; T.route.push([...p, 1]); return; }
  const d = haversine(T.lastFix, p), dt = (t - T.lastFix[2]) / 1000;
  if (dt <= 0 || d / dt > 9) return; // descarta saltos irreais (> 32 km/h)
  if (d < 4) return; // ruído do GPS parado
  addDistance(T.distM + d, t);
  T.lastFix = p;
  T.route.push(p);
}

function setManualDistance(km) {
  const m = Math.max(0, km * 1000);
  if (m > T.distM) addDistance(m, elapsed());
  else { T.distM = m; T.splits = T.splits.filter(s => s.km * 1000 <= m); }
  persist(); paint();
}

/* ---------- controles ---------- */

function start() {
  T.status = 'running'; T.startEpoch = Date.now(); T.segStart = Date.now(); T.date = todayISO();
  if (!T.planDate) T.planDate = pendingItemFor('run', T.date)?.origin || null;
  persist(); startSensors(); draw();
}
function pause() {
  T.accMs = elapsed(); T.status = 'paused'; T.lastFix = null;
  persist(); draw();
}
function resume() {
  T.status = 'running'; T.segStart = Date.now();
  persist(); draw();
}
function lap() {
  const t = elapsed(), prev = T.laps.at(-1);
  T.laps.push({ n: T.laps.length + 1, cumMs: t, sec: (t - (prev?.cumMs || 0)) / 1000, distM: T.distM - (prev?.cumDist || 0), cumDist: T.distM });
  persist(); draw(); toast(`Volta ${T.laps.length} registrada`);
}
function toggleInterval() {
  const t = elapsed();
  if (T.phase === 'work') {
    const iv = T.intervals.at(-1);
    iv.workSec = (t - iv.startMs) / 1000; iv.distM = T.distM - iv.startDist;
    T.phase = 'rec';
  } else {
    if (T.phase === 'rec') T.intervals.at(-1).recSec = (t - T.phaseStartMs) / 1000;
    T.intervals.push({ n: T.intervals.length + 1, startMs: t, startDist: T.distM });
    T.phase = 'work';
  }
  T.phaseStartMs = t;
  persist(); draw();
}

function startSensors() {
  if (usesGps() && 'geolocation' in navigator && watchId == null) {
    watchId = navigator.geolocation.watchPosition(onFix, err => {
      T.gpsAcc = null;
      toast(err.code === 1 ? 'Permissão de localização negada — a distância não será medida pelo GPS' : 'Sinal de GPS indisponível');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }
  requestWake();
  if (!tickTimer) tickTimer = setInterval(tick, 1000);
}
function stopSensors() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  clearInterval(tickTimer); tickTimer = null;
  wakeLock?.release?.().catch(() => {}); wakeLock = null;
  try { hrChar?.service?.device?.gatt?.disconnect(); } catch { /* sem cinta */ }
  hrChar = null;
}
async function requestWake() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { /* opcional */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && T?.status === 'running') requestWake(); });

async function connectHR() {
  if (!navigator.bluetooth) { toast('Bluetooth não disponível neste navegador (use o Chrome no Android)'); return; }
  try {
    const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    const server = await dev.gatt.connect();
    const svc = await server.getPrimaryService('heart_rate');
    hrChar = await svc.getCharacteristic('heart_rate_measurement');
    await hrChar.startNotifications();
    hrChar.addEventListener('characteristicvaluechanged', e => {
      const v = e.target.value, flags = v.getUint8(0);
      const hr = flags & 1 ? v.getUint16(1, true) : v.getUint8(1);
      T.hrNow = hr;
      const t = elapsed();
      if (T.status === 'running' && t - T.lastHrT >= 5000) { T.hr.push([Math.round(t), hr]); T.lastHrT = t; }
      paint();
    });
    toast('Sensor cardíaco conectado');
    draw();
  } catch (e) {
    if (e.name !== 'NotFoundError') toast('Não foi possível conectar o sensor');
  }
}

function thin(route, max = 800) {
  if (route.length <= max) return route;
  const step = Math.ceil(route.length / max);
  return route.filter((p, i) => i % step === 0 || p[3] || i === route.length - 1);
}

async function finish() {
  if (!confirm('Finalizar e salvar a corrida?')) return;
  if (T.status === 'running') { T.accMs = elapsed(); T.status = 'paused'; }
  if (T.phase === 'work') toggleInterval();
  if (T.phase === 'rec') T.intervals.at(-1).recSec = (T.accMs - T.phaseStartMs) / 1000;
  stopSensors();
  const dur = T.accMs / 1000, km = T.distM / 1000;
  const kg = latestWeight() || 70;
  const hrs = T.hr.map(h => h[1]);
  const ivPaces = T.intervals.filter(i => i.distM > 50 && i.workSec).map(i => i.workSec / (i.distM / 1000));
  const avgPace = km > 0.05 ? dur / km : null;
  const best = [...T.splits.map(s => s.sec), ...ivPaces];
  const session = {
    kind: 'run', date: T.date || todayISO(), planDate: T.planDate, runType: T.type, ref: T.type, modality: T.modality,
    startEpoch: T.startEpoch, durationSec: Math.round(dur), distanceKm: +km.toFixed(3),
    avgPaceSec: avgPace, avgSpeed: km > 0 ? km / (dur / 3600) : 0,
    kcal: Math.round(km > 0.05 ? runKcal(kg, km) : metKcal(8, kg, dur)),
    hrAvg: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
    hrMax: hrs.length ? Math.max(...hrs) : null,
    splits: T.splits.map(({ km, sec }) => ({ km, sec: +sec.toFixed(1) })),
    laps: T.laps.map(({ n, sec, distM }) => ({ n, sec: +sec.toFixed(1), distM: Math.round(distM) })),
    intervals: T.intervals.map(i => ({ n: i.n, workSec: +(i.workSec || 0).toFixed(1), recSec: i.recSec ? +i.recSec.toFixed(1) : null, distM: Math.round(i.distM || 0), paceSec: i.distM > 50 ? i.workSec / (i.distM / 1000) : null })),
    route: thin(T.route), hrSeries: T.hr,
    bestPaceSec: best.length ? Math.min(...best) : avgPace,
    source: 'cronometro',
  };
  const saved = await put('sessions', session);
  autoSend(saved);
  localStorage.removeItem(KEY);
  T = null;
  toast('Corrida salva');
  location.hash = `#/corrida/${saved.id}?novo=1`;
}

function discard() {
  if (!confirm('Descartar esta corrida sem salvar?')) return;
  stopSensors(); localStorage.removeItem(KEY); T = null;
  location.hash = '#/corridas';
}

/* ---------- interface ---------- */

function tick() {
  if (!T) return;
  if (++ticks % 5 === 0) persist();
  paint();
}

// Atualiza apenas os números (chamado a cada segundo)
function paint() {
  if (!T || !root?.isConnected || T.status === 'setup') return;
  const sec = elapsed() / 1000, km = T.distM / 1000;
  const set = (id, v) => { const e = root.querySelector('#' + id); if (e) e.textContent = v; };
  set('t-clock', fmtDur(sec));
  set('t-dist', fmtNum(km, 2));
  set('t-pace', fmtPace(currentPace()));
  set('t-avg', fmtPace(km > 0.05 ? sec / km : null));
  set('t-speed', fmtNum(km > 0 ? km / (sec / 3600) : 0, 1));
  const kg = latestWeight() || 70;
  set('t-kcal', fmtInt(km > 0.05 ? runKcal(kg, km) : metKcal(8, kg, sec)));
  set('t-hr', T.hrNow || '--');
  set('t-gps', usesGps() ? (T.gpsAcc ? `GPS ±${T.gpsAcc} m` : 'Procurando GPS…') : 'Esteira · sem GPS');
  if (T.phase) set('t-phase', fmtDur((elapsed() - T.phaseStartMs) / 1000));
  if (T.splits.length) set('t-lastsplit', `Último km: ${fmtPace(T.splits.at(-1).sec)}`);
}

function draw() {
  if (!root?.isConnected) return;
  if (T.status === 'setup') return drawSetup();
  const tpl = S.templates.run[T.type];
  const running = T.status === 'running';
  root.innerHTML = `
    <section class="tracker ${running ? 'on' : 'paused'}">
      <div class="row"><span class="badge ${running ? 'today' : 'moved'}">${running ? 'Correndo' : 'Pausado'}</span>
        <span class="small muted grow center">${esc(tpl?.name || 'Corrida ' + T.type)} · ${esc(MODALITIES.find(m => m[0] === T.modality)?.[1])}</span>
        <span class="small muted" id="t-gps"></span></div>
      <div class="timer-card"><div class="small muted center">Duração</div><div class="clock" id="t-clock">00:00</div></div>
      <div class="metrics">
        <div class="metric big"><span>Distância (km)</span><b id="t-dist">0,00</b></div>
        <div class="metric big"><span>Ritmo atual (/km)</span><b id="t-pace">--:--</b></div>
        <div class="metric"><span>Ritmo médio (/km)</span><b id="t-avg">--:--</b></div>
        <div class="metric"><span>Velocidade (km/h)</span><b id="t-speed">0,0</b></div>
        <div class="metric"><span>Calorias (est.)</span><b id="t-kcal">0</b></div>
        <div class="metric"><span>FC (bpm)</span><b id="t-hr">--</b></div>
      </div>
      <div class="small muted center" id="t-lastsplit"></div>

      ${T.modality === 'esteira' || !usesGps() ? `<div class="card tight">
        <div class="small muted">Distância informada pela esteira</div>
        <div class="row gap"><input type="number" inputmode="decimal" step="0.01" id="t-manual" value="${(T.distM / 1000).toFixed(2)}" aria-label="Distância em km">
          <button class="btn sm secondary" data-add="0.1">+0,1</button><button class="btn sm secondary" data-add="1">+1 km</button></div></div>` : ''}

      ${T.type === 'B' ? `<div class="card tight interval ${T.phase || ''}">
        <div class="row"><div class="grow"><div class="small muted">${T.phase === 'work' ? `Tiro ${T.intervals.length} em andamento` : T.phase === 'rec' ? `Recuperação após tiro ${T.intervals.length}` : `Meta: ${tpl.intervals} × ${tpl.workSec} s / ${tpl.recSec} s`}</div>
          <b class="phase-clock" id="t-phase">${T.phase ? '' : '--:--'}</b></div>
          <button class="btn ${T.phase === 'work' ? 'rest' : 'run'}" id="t-iv" ${running ? '' : 'disabled'}>${T.phase === 'work' ? 'Iniciar recuperação' : 'Iniciar tiro'}</button></div>
        ${T.intervals.filter(i => i.workSec).length ? `<div class="small muted">${T.intervals.filter(i => i.workSec).map(i => `#${i.n} ${fmtDur(i.workSec)}${i.distM > 50 ? ' · ' + fmtPace(i.workSec / (i.distM / 1000)) : ''}`).join(' | ')}</div>` : ''}
      </div>` : ''}

      <div class="controls">
        ${running ? '<button class="btn big strength" id="t-pause">Pausar</button>' : '<button class="btn big run" id="t-resume">Retomar</button>'}
        <button class="btn big secondary" id="t-lap">Volta</button>
        <button class="btn big danger" id="t-finish">Finalizar</button>
      </div>
      ${!hrChar && navigator.bluetooth ? '<button class="link small" id="t-hrbtn">Conectar sensor cardíaco (Bluetooth)</button>' : ''}

      ${T.splits.length ? `<h3>Parciais por km</h3><table><thead><tr><th>Km</th><th>Tempo</th><th>Acumulado</th></tr></thead><tbody>
        ${T.splits.slice().reverse().map(s => `<tr><td>${s.km}</td><td>${fmtPace(s.sec)}</td><td>${fmtDur(s.cumMs / 1000)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${T.laps.length ? `<h3>Voltas</h3><table><thead><tr><th>Volta</th><th>Tempo</th><th>Distância</th></tr></thead><tbody>
        ${T.laps.slice().reverse().map(l => `<tr><td>${l.n}</td><td>${fmtDur(l.sec)}</td><td>${fmtNum(l.distM / 1000, 2)} km</td></tr>`).join('')}</tbody></table>` : ''}
      ${!running ? '<button class="link small muted top" id="t-discard">Descartar corrida</button>' : ''}
    </section>`;
  $('#t-pause', root)?.addEventListener('click', pause);
  $('#t-resume', root)?.addEventListener('click', resume);
  $('#t-lap', root).onclick = lap;
  $('#t-finish', root).onclick = finish;
  $('#t-iv', root)?.addEventListener('click', toggleInterval);
  $('#t-hrbtn', root)?.addEventListener('click', connectHR);
  $('#t-discard', root)?.addEventListener('click', discard);
  const man = $('#t-manual', root);
  if (man) {
    man.onchange = () => setManualDistance(num(man.value) || 0);
    root.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { setManualDistance(T.distM / 1000 + +b.dataset.add); man.value = (T.distM / 1000).toFixed(2); });
  }
  paint();
}

function drawSetup() {
  const tpl = S.templates.run;
  const desc = T.type === 'A'
    ? `Meta: ${tpl.A.targetMin} min ou ${fmtNum(tpl.A.targetKm)} km em ritmo confortável.`
    : `Aquecimento ${tpl.B.warmupMin} min · ${tpl.B.intervals} × ${tpl.B.workSec} s forte / ${tpl.B.recSec} s leve · desaquecimento ${tpl.B.cooldownMin} min.`;
  root.innerHTML = `
    <section class="card head-card" style="--c:var(--run)">
      <h2>Nova corrida</h2>
      <div class="field"><span>Tipo de treino</span>${chips('type', [['A', 'A · Resistência'], ['B', 'B · Velocidade']], T.type)}</div>
      <p class="small">${esc(desc)}</p>
      <div class="field"><span>Modalidade</span>${chips('mod', MODALITIES, T.modality)}</div>
      <p class="small muted">${T.modality === 'esteira'
        ? 'Na esteira, o cronômetro funciona normalmente e você informa a distância mostrada no painel do equipamento.'
        : 'Ao ar livre, o GPS do celular calcula distância, velocidade e trajeto. Mantenha a tela ligada durante a corrida para maior precisão.'}</p>
      ${T.modality !== 'esteira' ? `<label class="row small"><input type="checkbox" id="s-gps" ${T.gps ? 'checked' : ''} style="width:auto"> Usar GPS</label>` : ''}
      <button class="btn big run block top" id="s-start">Iniciar</button>
      <div class="row gap top">
        ${navigator.bluetooth ? `<button class="btn secondary grow" id="s-hr">${hrChar ? 'Sensor conectado ✓' : 'Conectar sensor cardíaco'}</button>` : ''}
        <a class="btn secondary grow" href="#/corrida-manual?tipo=${T.type}&modalidade=${T.modality}${T.planDate ? '&plan=' + T.planDate : ''}">Inserir manualmente</a>
      </div>
    </section>`;
  bindChips(root, (n, v) => {
    if (n === 'type') T.type = v;
    if (n === 'mod') T.modality = v;
    drawSetup();
  });
  $('#s-gps', root)?.addEventListener('change', e => { T.gps = e.target.checked; });
  $('#s-hr', root)?.addEventListener('click', connectHR);
  $('#s-start', root).onclick = () => {
    if (usesGps() && 'geolocation' in navigator) navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true });
    start();
  };
}

export function render(el, p) {
  root = el;
  if (!isLive()) {
    if (!T || T.status !== 'setup' || p.tipo || p.plan) T = newState(p);
  } else {
    startSensors(); // retoma após recarregar a página
  }
  draw();
}
