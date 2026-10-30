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

const LISTS = ['sessions', 'body', 'recovery', 'reschedules'];
const byDate = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.startEpoch || a.createdAt || 0) - (b.startEpoch || b.createdAt || 0);

export async function load() {
  const kv = Object.fromEntries((await db.all('kv')).map(r => [r.id, r.value]));
  S.profile = { ...defaultProfile(), ...(kv.profile || {}) };
  S.planHistory = kv.planHistory || [{ from: '2000-01-01', days: defaultDays() }];
  S.templates = kv.templates || defaultTemplates();
  S.customExercises = kv.customExercises || [];
  S.exerciseNotes = kv.exerciseNotes || {};
  S.goals = kv.goals || [];
  if (!kv.planHistory) await setKV('planHistory', S.planHistory);
  if (!kv.templates) await setKV('templates', S.templates);
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
    await setKV('templates', t);
    if (S.sessions.some(x => x.kind !== 'rest')) await savePlan(defaultDays());
    else await setKV('planHistory', [{ from: '2000-01-01', days: defaultDays() }]);
  }
  await setKV('migration', 2);
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
  await setKV('templates', t);
  await setKV('migration', 3);
}

export async function setKV(key, value) {
  S[key] = value;
  await db.put('kv', { id: key, value });
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
  return obj;
}

export async function del(store, id) {
  await db.del(store, id);
  S[store] = S[store].filter(x => x.id !== id);
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
