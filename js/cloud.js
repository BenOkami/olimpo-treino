// Nuvem (Supabase): login por e-mail e sincronização automática de todo o histórico.
// O app continua funcionando offline; as alterações ficam numa fila e sobem quando houver internet.
// Em conflito, vale a alteração mais recente (a tabela no servidor também garante isso).
import { hooks, localRecord, allLocalKeys, applyRemote, SYNC_KV } from './store.js';
import { CLOUD } from './cloud-config.js';

const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const Q_KEY = 'cloud-queue', PULL_KEY = 'cloud-last-pull', LAST_KEY = 'cloud-last-sync', FIRST_KEY = 'cloud-first-sync-done';
const EPOCH = '1970-01-01T00:00:00Z';

let sb = null, user = null, busy = false, timer = null, onData = () => {};
let phase = 'idle', lastError = null;
const listeners = new Set();

export const configured = () => !!(CLOUD.url && CLOUD.key);
export const onStatus = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const status = () => ({
  configured: configured(), user, phase, error: lastError,
  last: +localStorage.getItem(LAST_KEY) || null, pending: queue().length,
});
const emit = () => listeners.forEach(fn => { try { fn(status()); } catch { /* tela já fechada */ } });

const queue = () => { try { return JSON.parse(localStorage.getItem(Q_KEY)) || []; } catch { return []; } };
const saveQueue = q => localStorage.setItem(Q_KEY, JSON.stringify(q));
function enqueue(store, id) {
  const k = `${store}|${id}`, q = queue();
  if (!q.includes(k)) { q.push(k); saveQueue(q); }
  clearTimeout(timer);
  timer = setTimeout(sync, 3000);
}

async function client() {
  if (sb || !configured()) return sb;
  const { createClient } = await import(SDK);
  sb = createClient(CLOUD.url, CLOUD.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'olimpo-auth', detectSessionInUrl: false } });
  sb.auth.onAuthStateChange((_ev, session) => { user = session?.user || null; emit(); });
  const { data } = await sb.auth.getSession();
  user = data.session?.user || null;
  return sb;
}

export async function initCloud(onDataChanged) {
  onData = onDataChanged || onData;
  hooks.onChange = (store, id) => {
    if (!user || (store === 'kv' && !SYNC_KV.includes(id))) return;
    enqueue(store, id);
  };
  if (!configured()) return;
  try { await client(); } catch { phase = 'offline'; emit(); return; }
  if (user) sync();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
  window.addEventListener('online', () => sync());
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 60000);
}

/* ---------- conta ---------- */

export async function signIn(email, password) {
  const c = await client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(authMessage(error));
  await afterLogin();
}

export async function signUp(email, password) {
  const c = await client();
  // o link de confirmação do e-mail volta para o app publicado
  const { data, error } = await c.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}${location.pathname}` } });
  if (error) throw new Error(authMessage(error));
  if (!data.session) return 'confirm'; // o Supabase pediu confirmação por e-mail
  await afterLogin();
  return 'ok';
}

export async function signOut() {
  if (sb) await sb.auth.signOut().catch(() => {});
  user = null;
  [Q_KEY, PULL_KEY, LAST_KEY, FIRST_KEY].forEach(k => localStorage.removeItem(k));
  emit();
}

// Primeiro login neste aparelho: envia tudo o que já existe aqui e baixa o que está na nuvem
async function afterLogin() {
  if (localStorage.getItem(FIRST_KEY) !== user?.id) {
    saveQueue([...new Set([...queue(), ...allLocalKeys().map(([s, id]) => `${s}|${id}`)])]);
    localStorage.removeItem(PULL_KEY);
    localStorage.setItem(FIRST_KEY, user.id);
  }
  await sync();
}

function authMessage(e) {
  const m = (e.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que o Supabase enviou e tente de novo.';
  if (m.includes('already registered')) return 'Este e-mail já tem conta. Use "Entrar".';
  if (m.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('fetch') || m.includes('network')) return 'Sem conexão com a internet.';
  return e.message || 'Não foi possível entrar.';
}

/* ---------- sincronização ---------- */

export async function sync({ full = false } = {}) {
  if (busy || !user || !navigator.onLine) { emit(); return; }
  busy = true; phase = 'syncing'; lastError = null; emit();
  try {
    if (full) localStorage.removeItem(PULL_KEY);
    await push();
    const changed = await pull();
    await push(); // o que foi alterado durante o download
    localStorage.setItem(LAST_KEY, String(Date.now()));
    phase = 'ok';
    if (changed) onData();
  } catch (e) {
    phase = 'error';
    lastError = /fetch|network|load failed/i.test(e.message || '') ? 'Sem conexão — tentaremos de novo.' : (e.message || 'Erro ao sincronizar');
  } finally {
    busy = false; emit();
  }
}

async function push() {
  let q = queue();
  while (q.length) {
    const batch = q.slice(0, 40), rows = [];
    for (const k of batch) {
      const [store, ...rest] = k.split('|');
      const id = rest.join('|');
      const L = localRecord(store, id);
      let data = L.data ?? null;
      if (store === 'body' && data) data = await uploadPhotos(data);
      rows.push({ user_id: user.id, store, id, data, deleted: !!L.deleted, updated_at: Math.round(L.updatedAt ?? Date.now()) });
    }
    const { error } = await sb.from('records').upsert(rows, { onConflict: 'user_id,store,id' });
    if (error) throw error;
    q = queue().filter(k => !batch.includes(k));
    saveQueue(q);
  }
}

async function pull() {
  let since = localStorage.getItem(PULL_KEY) || EPOCH, changed = false;
  const PAGE = 300;
  for (;;) {
    const { data, error } = await sb.from('records').select('store,id,data,deleted,updated_at,server_ts')
      .gt('server_ts', since).order('server_ts', { ascending: true }).limit(PAGE);
    if (error) throw error;
    for (const r of data) {
      const remoteTime = Number(r.updated_at);
      let d = r.data;
      // só baixa as fotos se o registro da nuvem for mesmo mais novo que o deste aparelho
      if (r.store === 'body' && d && !r.deleted && (localRecord('body', r.id).updatedAt ?? -1) < remoteTime) d = await downloadPhotos(d);
      if (await applyRemote(r.store, r.id, d, r.deleted, remoteTime)) changed = true;
      since = r.server_ts;
    }
    localStorage.setItem(PULL_KEY, since);
    if (data.length < PAGE) break;
  }
  return changed;
}

/* ---------- fotos: ficam no Storage privado; o registro guarda só o caminho ---------- */

async function uploadPhotos(rec) {
  if (!rec.photos) return rec;
  const photos = {};
  for (const [pose, src] of Object.entries(rec.photos)) {
    if (!src) continue;
    if (!String(src).startsWith('data:')) { photos[pose] = src; continue; }
    const path = `${user.id}/${rec.id}_${pose}.jpg`;
    const blob = await (await fetch(src)).blob();
    const { error } = await sb.storage.from('photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (error) throw error;
    photos[pose] = 'sb:' + path;
  }
  return { ...rec, photos };
}

async function downloadPhotos(rec) {
  if (!rec.photos) return rec;
  const photos = {};
  for (const [pose, src] of Object.entries(rec.photos)) {
    if (!String(src || '').startsWith('sb:')) { photos[pose] = src; continue; }
    const { data, error } = await sb.storage.from('photos').download(src.slice(3));
    if (error || !data) continue;
    photos[pose] = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(data); });
  }
  return { ...rec, photos };
}
