// Olimpo · função "strava" (Supabase Edge Function)
// Guarda a chave secreta do Strava no servidor e faz a ponte entre o app e a API do Strava.
// Segredos necessários (Edge Functions → Secrets): STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET.
// Publicar com a verificação de JWT DESLIGADA: o retorno do Strava pode abrir fora do app;
// a função confere o usuário por conta própria em todas as ações, menos "exchange" (que usa o código temporário).
import { createClient } from 'npm:@supabase/supabase-js@2';

const CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') ?? '';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const API = 'https://www.strava.com/api/v3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function saveTokens(userId: string, t: any) {
  const { error } = await admin.from('strava_tokens').upsert({
    user_id: userId, athlete_id: t.athlete?.id ?? undefined, athlete: t.athlete ?? undefined,
    access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

// Token válido do usuário (renova sozinho quando está para vencer)
async function accessToken(userId: string): Promise<string> {
  const { data: row } = await admin.from('strava_tokens').select('*').eq('user_id', userId).maybeSingle();
  if (!row) throw new Error('not_connected');
  if (row.expires_at > Date.now() / 1000 + 120) return row.access_token;
  const r = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: row.refresh_token }),
  });
  const t = await r.json();
  if (!r.ok) throw new Error('refresh_failed');
  await saveTokens(userId, t);
  return t.access_token;
}

async function strava(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.message || `strava_${r.status}`);
  return body;
}

// Envia um GPX e espera o Strava processar (o upload é assíncrono)
async function uploadGpx(token: string, a: any) {
  const form = new FormData();
  form.append('file', new Blob([a.gpx], { type: 'application/gpx+xml' }), 'olimpo.gpx');
  form.append('data_type', 'gpx');
  form.append('name', a.name);
  if (a.description) form.append('description', a.description);
  if (a.sport_type) form.append('sport_type', a.sport_type);
  if (a.external_id) form.append('external_id', a.external_id);
  let up = await strava(token, '/uploads', { method: 'POST', body: form });
  for (let i = 0; i < 8 && !up.activity_id && !up.error; i++) {
    await sleep(1500);
    up = await strava(token, `/uploads/${up.id}`);
  }
  if (up.error) {
    const dup = String(up.error).match(/duplicate of .*?(\d+)/i);
    if (dup) return { activityId: Number(dup[1]), duplicate: true };
    throw new Error(up.error);
  }
  return { activityId: up.activity_id ?? null, uploadId: up.id };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!CLIENT_ID || !CLIENT_SECRET) return fail('Configure STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET nos segredos da função.', 500);
  let body: any;
  try { body = await req.json(); } catch { return fail('Pedido inválido'); }

  try {
    // Retorno do Strava: troca o código pela chave de acesso. Identifica o usuário pelo código temporário (state).
    if (body.action === 'exchange') {
      const { data: st } = await admin.from('strava_oauth_state').select('*').eq('nonce', body.state ?? '').maybeSingle();
      if (!st || Date.now() - Date.parse(st.created_at) > 20 * 60 * 1000) return fail('Pedido de conexão expirado. Tente conectar de novo.');
      const r = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code: body.code, grant_type: 'authorization_code' }),
      });
      const t = await r.json();
      if (!r.ok) return fail(t?.message || 'O Strava recusou a conexão.');
      await saveTokens(st.user_id, t);
      await admin.from('strava_oauth_state').delete().eq('nonce', st.nonce);
      return json({ ok: true, athlete: { firstname: t.athlete?.firstname, lastname: t.athlete?.lastname } });
    }

    // Demais ações: exigem o usuário logado no app
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(jwt);
    const user = auth?.user;
    if (!user) return fail('Entre na sua conta do Olimpo primeiro.', 401);

    switch (body.action) {
      case 'start': {
        const nonce = crypto.randomUUID();
        await admin.from('strava_oauth_state').delete().lt('created_at', new Date(Date.now() - 86400000).toISOString());
        await admin.from('strava_oauth_state').insert({ nonce, user_id: user.id });
        const url = new URL('https://www.strava.com/oauth/authorize');
        url.searchParams.set('client_id', CLIENT_ID);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('redirect_uri', body.redirect);
        url.searchParams.set('approval_prompt', 'auto');
        url.searchParams.set('scope', 'read,activity:read_all,activity:write');
        url.searchParams.set('state', nonce);
        return json({ url: url.toString() });
      }
      case 'status': {
        const { data: row } = await admin.from('strava_tokens').select('athlete').eq('user_id', user.id).maybeSingle();
        return json({ connected: !!row, athlete: row ? { firstname: row.athlete?.firstname, lastname: row.athlete?.lastname } : null });
      }
      case 'disconnect': {
        try { await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: `Bearer ${await accessToken(user.id)}` } }); } catch { /* já desconectado */ }
        await admin.from('strava_tokens').delete().eq('user_id', user.id);
        return json({ ok: true });
      }
      case 'upload': {
        const token = await accessToken(user.id);
        const a = body.activity || {};
        if (a.gpx) return json(await uploadGpx(token, a));
        const form = new URLSearchParams({
          name: a.name, sport_type: a.sport_type || 'Run', start_date_local: a.start_date_local,
          elapsed_time: String(Math.max(1, Math.round(a.elapsed_time || 0))),
        });
        if (a.distance) form.set('distance', String(Math.round(a.distance)));
        if (a.description) form.set('description', a.description);
        if (a.trainer) form.set('trainer', '1');
        const act = await strava(token, '/activities', { method: 'POST', body: form });
        return json({ activityId: act.id });
      }
      case 'list': {
        const token = await accessToken(user.id);
        const after = Math.floor(Number(body.after) || (Date.now() / 1000 - 30 * 86400));
        const out: any[] = [];
        for (let page = 1; page <= 4; page++) {
          const list = await strava(token, `/athlete/activities?after=${after}&per_page=50&page=${page}`);
          out.push(...list.map((x: any) => ({
            id: x.id, name: x.name, sport_type: x.sport_type || x.type, start_date: x.start_date, start_date_local: x.start_date_local,
            distance: x.distance, moving_time: x.moving_time, elapsed_time: x.elapsed_time, average_speed: x.average_speed,
            max_speed: x.max_speed, average_heartrate: x.average_heartrate, max_heartrate: x.max_heartrate, trainer: x.trainer,
            workout_type: x.workout_type, polyline: x.map?.summary_polyline || null, external_id: x.external_id,
          })));
          if (list.length < 50) break;
        }
        return json({ activities: out });
      }
      default:
        return fail('Ação desconhecida');
    }
  } catch (e) {
    const m = (e as Error).message;
    if (m === 'not_connected') return fail('Strava não conectado.', 409);
    if (m === 'refresh_failed') return fail('A conexão com o Strava expirou. Conecte de novo.', 409);
    return fail(m || 'Erro no Strava', 502);
  }
});
