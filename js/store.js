// Estado em memória com gravação imediata no IndexedDB (histórico único).
import { db, STORES } from './db.js';
import { uid, todayISO, weekStart } from './util.js';
import { defaultDays, defaultTemplates, defaultProfile, defaultStrength, RUN_NAMES } from './defaults.js';

export const S = {
  profile: null,
  planHistory: null, // [{from: 'AAAA-MM-DD', days: [7 itens]}] – preserva o planejamento original de semanas passadas
  templates: null,
  customExercises: [], exerciseNotes: {}, goals: [],
  sessions: [], body: [], recovery: [], reschedules: [],
};

export const LISTS = ['sessions', 'body', 'recovery', 'reschedules'];
// Chaves de configuração que vão para a nuvem (a marca de migração é só do aparelho)
export const SYNC_KV = ['profile', 'planHistory', 'templates', 'customExercises', 'exerciseNotes', 'goals'];

// Avisado a cada alteração feita pelo usuário (a sincronização com a nuvem se registra aqui)
export const hooks = { onChange: null };
const changed = (store, id) => { try { hooks.onChange?.(store, id); } catch { /* sincronização é opcional */ } };
const kvTimes = {};
const byDate = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.startEpoch || a.createdAt || 0) - (b.startEpoch || b.createdAt || 0);

export async function load() {
  const rows = await db.all('kv');
  const kv = Object.fromEntries(rows.map(r => [r.id, r.value]));
  for (const r of rows) kvTimes[r.id] = r.updatedAt || 0;
  S.profile = { ...defaultProfile(), ...(kv.profile || {}) };
  S.planHistory = kv.planHistory || [{ from: '2000-01-01', days: defaultDays() }];
  S.templates = kv.templates || defaultTemplates();
  S.customExercises = kv.customExercises || [];
  S.exerciseNotes = kv.exerciseNotes || {};
  S.goals = kv.goals || [];
  if (!kv.planHistory) await setKV('planHistory', S.planHistory, { silent: true });
  if (!kv.templates) await setKV('templates', S.templates, { silent: true });
  for (const s of LISTS) S[s] = (await db.all(s)).sort(byDate);
  await migrate(kv);
  await renameGods();
}

// Migração única para o plano "Olimpo": 5 dias de musculação (deuses gregos) + corrida em 2 dias.
// O histórico registrado nunca é alterado; semanas passadas mantêm o plano original.
async function migrate(kv) {
  S.migration = kv.migration || 0;
  if (S.migration >= 2) return;
  if (kv.templates) {
    const t = structuredClone(S.templates);
    t.strength = defaultStrength();
    for (const r of ['A', 'B']) t.run[r] = { ...t.run[r], ...RUN_NAMES[r] };
    await setKV('templates', t, { silent: true });
    if (S.sessions.some(x => x.kind !== 'rest')) await savePlan(defaultDays());
    else await setKV('planHistory', [{ from: '2000-01-01', days: defaultDays() }], { silent: true });
  }
  await setKV('migration', 2, { silent: true });
}

const GOD_NAMES = { A: 'Ares', B: 'Atlas', C: 'Hércules', D: 'Apolo', E: 'Ártemis' };
async function renameGods() {
  if ((S.migration || 0) >= 3) return;
  const t = structuredClone(S.templates);
  for (const [k, god] of Object.entries(GOD_NAMES)) {
    const x = t.strength[k];
    if (x?.name === god) { x.name = `Treino ${k}`; delete x.motto; }
  }
  for (const r of ['A', 'B']) {
    if (['Fidípides', 'Hermes'].includes(t.run[r]?.name)) { delete t.run[r].motto; Object.assign(t.run[r], RUN_NAMES[r]); }
  }
  await setKV('templates', t, { silent: true });
  await setKV('migration', 3, { silent: true });
}

export async function setKV(key, value, { silent = false } = {}) {
  S[key] = value;
  if (!silent) kvTimes[key] = Date.now();
  await db.put('kv', { id: key, value, updatedAt: kvTimes[key] || 0 });
  if (!silent) changed('kv', key);
}

export async function put(store, obj) {
  if (!obj.id) { obj.id = uid(); obj.createdAt = Date.now(); }
  obj.updatedAt = Date.now();
  await db.put(store, obj);
  const arr = S[store];
  const i = arr.findIndex(x => x.id === obj.id);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
  arr.sort(byDate);
  requestPersistence();
  changed(store, obj.id);
  return obj;
}

export async function del(store, id) {
  await db.del(store, id);
  S[store] = S[store].filter(x => x.id !== id);
  changed(store, id);
}

/* ---------- usado pela sincronização com a nuvem ---------- */

// Estado local de um registro: { data, updatedAt } ou { deleted: true, updatedAt: null } quando não existe aqui.
// Configurações nunca editadas valem 1 ms: qualquer versão real da nuvem tem prioridade sobre elas.
export function localRecord(store, id) {
  if (store === 'kv') return S[id] === undefined ? { deleted: true, updatedAt: null } : { data: S[id], updatedAt: kvTimes[id] || 1 };
  const obj = S[store].find(x => x.id === id);
  return obj ? { data: obj, updatedAt: obj.updatedAt || obj.createdAt || 1 } : { deleted: true, updatedAt: null };
}

// Tudo o que deve subir no primeiro login. Configurações sem data só sobem se tiverem conteúdo do usuário,
// para um aparelho novo não mandar o perfil vazio e o plano padrão por cima dos dados reais.
export function allLocalKeys() {
  const hasContent = k => k === 'profile' ? !!S.profile?.name
    : Array.isArray(S[k]) ? S[k].length > 0
      : S[k] && typeof S[k] === 'object' ? Object.keys(S[k]).length > 0 : false;
  const kvKeys = SYNC_KV.filter(k => S[k] !== undefined && (kvTimes[k] > 0 || (!['templates', 'planHistory'].includes(k) && hasContent(k))));
  return [...kvKeys.map(k => ['kv', k]), ...LISTS.flatMap(s => S[s].map(x => [s, x.id]))];
}

// Aplica um registro vindo da nuvem se ele for mais novo que o local. Retorna true se mudou algo.
export async function applyRemote(store, id, data, deleted, updatedAt) {
  if (store === 'kv') {
    if (!SYNC_KV.includes(id) || (kvTimes[id] || 0) >= updatedAt || deleted) return false;
    kvTimes[id] = updatedAt;
    S[id] = id === 'profile' ? { ...defaultProfile(), ...data } : data;
    await db.put('kv', { id, value: S[id], updatedAt });
    return true;
  }
  if (!LISTS.includes(store)) return false;
  const arr = S[store], i = arr.findIndex(x => x.id === id);
  const local = i >= 0 ? arr[i].updatedAt || arr[i].createdAt || 0 : -1;
  if (local >= updatedAt) return false;
  if (deleted) {
    if (i < 0) return false;
    await db.del(store, id);
    S[store] = arr.filter(x => x.id !== id);
    return true;
  }
  const obj = { ...data, id, updatedAt };
  await db.put(store, obj);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
  arr.sort(byDate);
  return true;
}

export function currentDays() {
  return S.planHistory.at(-1).days;
}

// Nova versão do plano vale a partir da semana atual; semanas anteriores mantêm o plano original.
export async function savePlan(days) {
  const from = weekStart(todayISO());
  const hist = S.planHistory.filter(v => v.from < from);
  hist.push({ from, days });
  await setKV('planHistory', hist);
}

export function exportAll() {
  return {
    app: 'treino-integrado', version: 1, exportedAt: new Date().toISOString(),
    kv: { profile: S.profile, planHistory: S.planHistory, templates: S.templates, customExercises: S.customExercises, exerciseNotes: S.exerciseNotes, goals: S.goals, migration: S.migration },
    ...Object.fromEntries(LISTS.map(s => [s, S[s]])),
  };
}

export async function importAll(data) {
  if (data?.app !== 'treino-integrado') throw new Error('Arquivo de backup inválido');
  for (const s of STORES) await db.clear(s);
  for (const [k, v] of Object.entries(data.kv || {})) await db.put('kv', { id: k, value: v });
  for (const s of LISTS) for (const r of data[s] || []) await db.put(s, r);
  await load();
}

export async function wipe() {
  for (const s of STORES) await db.clear(s);
  await load();
}

let persistAsked = false;
function requestPersistence() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}
