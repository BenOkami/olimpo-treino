// Calendário: o que está planejado em cada data, remarcações e status de conclusão.
import { S, put, del } from './store.js';
import { dowIdx, addDays, todayISO } from './util.js';
import { REST_NAME } from './defaults.js';

export function planDaysFor(iso) {
  let days = S.planHistory[0].days;
  for (const v of S.planHistory) if (v.from <= iso) days = v.days;
  return days;
}

// Um dia do plano pode ter o treino principal e uma corrida extra (day.run)
export const dayItems = day => !day ? [] : [{ type: day.type, ref: day.ref }, ...(day.run && day.type !== 'run' ? [{ type: 'run', ref: day.run }] : [])];

// Remarcações antigas não guardavam o tipo de forma separada; o tipo do item identifica qual atividade do dia foi movida
const movedOut = (iso, type) => S.reschedules.find(r => r.from === iso && r.item.type === type);

// Itens de uma data. Um item remarcado aparece na data original (movedTo) e na nova data (movedFrom).
export function itemsFor(iso) {
  const items = [];
  for (const base of dayItems(planDaysFor(iso)[dowIdx(iso)])) {
    const out = movedOut(iso, base.type);
    const src = out ? out.item : base;
    items.push({ type: src.type, ref: src.ref, origin: iso, date: out ? out.to : iso, movedTo: out?.to || null, rid: out?.id || null });
  }
  for (const r of S.reschedules) {
    if (r.to === iso && r.from !== iso) items.push({ type: r.item.type, ref: r.item.ref, origin: r.from, date: iso, movedFrom: r.from, rid: r.id });
  }
  return items;
}

export const activeItemsFor = iso => itemsFor(iso).filter(i => !i.movedTo);

export const sessionFor = item => S.sessions.find(s => s.planDate === item.origin && s.kind === item.type);

export function statusOf(item, today = todayISO()) {
  if (sessionFor(item)) return 'done';
  if (item.movedTo) return 'moved';
  if (item.type === 'rest') return 'rest';
  if (item.date < today) return 'missed';
  if (item.date === today) return 'today';
  return 'pending';
}

export function weekProgress(ws) {
  let total = 0, done = 0;
  for (let i = 0; i < 7; i++) {
    for (const it of activeItemsFor(addDays(ws, i))) {
      if (it.type === 'rest') continue;
      total++;
      if (sessionFor(it)) done++;
    }
  }
  return { total, done };
}

export const pendingItemFor = (kind, iso) => activeItemsFor(iso).find(i => i.type === kind && !sessionFor(i));

export function labelOf(item) {
  if (item.type === 'strength') {
    const t = S.templates.strength[item.ref];
    return { title: t?.name || `Musculação ${item.ref}`, sub: t?.groups || '' };
  }
  if (item.type === 'run') {
    const t = S.templates.run[item.ref];
    return { title: t?.name || `Corrida ${item.ref}`, sub: t?.goals || '' };
  }
  return { title: REST_NAME.name, sub: REST_NAME.sub };
}

export function actionHref(item) {
  const s = sessionFor(item);
  if (item.type === 'strength') return s ? `#/treino?id=${s.id}` : `#/treino?ref=${item.ref}&plan=${item.origin}&date=${item.date}`;
  if (item.type === 'run') return s ? `#/corrida/${s.id}` : `#/correr?tipo=${item.ref}&plan=${item.origin}`;
  return s ? `#/descanso?id=${s.id}` : `#/descanso?plan=${item.origin}&date=${item.date}`;
}

export async function reschedule(item, to) {
  const existing = movedOut(item.origin, item.type);
  if (to === item.origin) { if (existing) await del('reschedules', existing.id); return; }
  await put('reschedules', { ...(existing || {}), from: item.origin, date: item.origin, to, item: { type: item.type, ref: item.ref } });
}

export async function undoReschedule(item) {
  if (item.rid) await del('reschedules', item.rid);
}
