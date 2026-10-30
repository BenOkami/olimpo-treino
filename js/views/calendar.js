// Calendário mensal integrado com detalhes do dia e remarcação.
import { S } from '../store.js';
import { todayISO, toISO, parseISO, addDays, weekStart, MONTHS, DAY_SHORT, fmtDateLong, fmtDate, fmtDur, fmtPace, fmtNum, fmtInt, esc } from '../util.js';
import { itemsFor, statusOf, labelOf, actionHref, reschedule, undoReschedule } from '../schedule.js';
import { strengthVolume } from '../analysis.js';
import { badge, TYPE_COLOR, $, $$, sheet } from '../ui.js';
import { MODALITIES, REST_ACTIVITIES, MEASURES } from '../defaults.js';
import { toast } from '../util.js';
import { cardioName } from './cardio.js';

let month = null, selected = null;

export function render(el, p) {
  const today = todayISO();
  if (p.data) selected = p.data;
  selected ||= today;
  month ||= selected.slice(0, 7);
  draw(el, today);
}

function dayMarks(d, today) {
  const items = itemsFor(d);
  const extra = S.sessions.filter(s => s.date === d && !items.some(i => i.origin === s.planDate && i.type === s.kind));
  const marks = items.map(it => {
    const st = statusOf(it, today);
    const cls = st === 'done' ? 'full' : it.movedTo ? 'ghost' : st === 'missed' ? 'miss' : 'hollow';
    return `<i class="mk ${cls}" style="--c:${TYPE_COLOR[it.type]}"></i>`;
  });
  extra.forEach(s => marks.push(`<i class="mk full" style="--c:${TYPE_COLOR[s.kind]}"></i>`));
  return marks.join('');
}

function draw(el, today) {
  const first = parseISO(month + '-01');
  const gridStart = weekStart(month + '-01');
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    if (i >= 35 && d.slice(0, 7) !== month) break;
    cells.push(`<button class="d ${d.slice(0, 7) !== month ? 'out' : ''} ${d === today ? 'today' : ''} ${d === selected ? 'sel' : ''}" data-d="${d}">
      <span>${+d.slice(8)}</span><span class="mks">${dayMarks(d, today)}</span></button>`);
  }
  el.innerHTML = `
    <section class="card">
      <div class="row cal-nav">
        <button class="btn sm secondary" data-m="-1" aria-label="Mês anterior">‹</button>
        <h2 class="grow center">${MONTHS[first.getMonth()]} ${first.getFullYear()}</h2>
        <button class="btn sm secondary" data-m="1" aria-label="Próximo mês">›</button>
      </div>
      <div class="cal">${DAY_SHORT.map(n => `<div class="h">${n}</div>`).join('')}${cells.join('')}</div>
      <div class="legend cal-legend">
        <span><i class="mk full" style="--c:var(--strength)"></i>Musculação</span>
        <span><i class="mk full" style="--c:var(--run)"></i>Corrida</span>
        <span><i class="mk full" style="--c:var(--rest)"></i>Descanso</span>
        <span><i class="mk full" style="--c:var(--cardio)"></i>Cardio</span>
        <span><i class="mk full" style="--c:var(--muted)"></i>Concluído</span>
        <span><i class="mk hollow" style="--c:var(--muted)"></i>Pendente</span>
        <span><i class="mk miss" style="--c:var(--muted)"></i>Não realizado</span>
      </div>
    </section>
    <section class="card" id="day-detail">${dayDetail(selected, today)}</section>`;

  $$('[data-m]', el).forEach(b => b.onclick = () => {
    const d = parseISO(month + '-01'); d.setMonth(d.getMonth() + +b.dataset.m);
    month = toISO(d).slice(0, 7); draw(el, today);
  });
  $$('.cal .d', el).forEach(b => b.onclick = () => {
    selected = b.dataset.d;
    if (selected.slice(0, 7) !== month) month = selected.slice(0, 7);
    draw(el, today);
    $('#day-detail', el).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  bindDetail(el, today);
}

function sessionSummary(s) {
  if (s.kind === 'run') {
    return `<div class="sess" style="--c:var(--run)"><div class="row"><b class="grow">Corrida ${esc(s.runType)} · ${esc(MODALITIES.find(m => m[0] === s.modality)?.[1] || '')}</b><a href="#/corrida/${s.id}" class="small">Abrir</a></div>
      <div class="kv"><span>Distância</span><b>${fmtNum(s.distanceKm, 2)} km</b><span>Tempo</span><b>${fmtDur(s.durationSec)}</b>
      <span>Ritmo médio</span><b>${fmtPace(s.avgPaceSec)}/km</b><span>Velocidade</span><b>${fmtNum(s.avgSpeed)} km/h</b>
      ${s.hrAvg ? `<span>FC média</span><b>${s.hrAvg} bpm</b>` : ''}<span>Calorias</span><b>~${fmtInt(s.kcal)} kcal</b>
      ${s.rpe ? `<span>Esforço</span><b>${s.rpe}/10</b>` : ''}</div>${s.notes ? `<p class="small muted">${esc(s.notes)}</p>` : ''}</div>`;
  }
  if (s.kind === 'strength') {
    const t = S.templates.strength[s.ref];
    return `<div class="sess" style="--c:var(--strength)"><div class="row"><b class="grow">${esc(t?.name || 'Musculação ' + s.ref)}</b><a href="#/treino?id=${s.id}" class="small">Editar</a></div>
      <div class="kv"><span>Duração</span><b>${fmtDur(s.durationSec)}</b><span>Volume</span><b>${fmtInt(strengthVolume(s))} kg</b>${s.rpe ? `<span>Esforço</span><b>${s.rpe}/10</b>` : ''}</div>
      <table class="mini"><tbody>${(s.exercises || []).filter(e => e.sets.some(x => x.done)).map(e => `<tr><td>${esc(e.name)}</td><td>${e.sets.filter(x => x.done).map(x => `${fmtNum(x.load || 0, 1).replace(',0', '')}${e.unit === 's' ? '' : 'kg'}×${x.reps}${e.unit === 's' ? 's' : ''}`).join(' · ')}</td></tr>`).join('')}</tbody></table>
      ${s.notes ? `<p class="small muted">${esc(s.notes)}</p>` : ''}</div>`;
  }
  if (s.kind === 'cardio') {
    return `<div class="sess" style="--c:var(--cardio)"><div class="row"><b class="grow">${esc(cardioName(s.cardioType))}</b><a href="#/cardio?id=${s.id}" class="small">Editar</a></div>
      <div class="kv"><span>Tempo</span><b>${fmtDur(s.durationSec)}</b>${s.distanceKm ? `<span>Distância</span><b>${fmtNum(s.distanceKm, 2)} km</b>` : ''}
      ${s.avgSpeed ? `<span>Velocidade</span><b>${fmtNum(s.avgSpeed)} km/h</b>` : ''}${s.incline ? `<span>Inclinação</span><b>${fmtNum(s.incline)}%</b>` : ''}
      ${s.resistance ? `<span>Resistência</span><b>nível ${s.resistance}</b>` : ''}<span>Calorias</span><b>~${fmtInt(s.kcal)} kcal (est.)</b></div></div>`;
  }
  return `<div class="sess" style="--c:var(--rest)"><div class="row"><b class="grow">Recuperação</b><a href="#/descanso?id=${s.id}" class="small">Editar</a></div>
    <div class="small">${(s.activities || []).map(a => esc(REST_ACTIVITIES.find(r => r[0] === a)?.[1] || a)).join(', ')}${s.durationSec ? ` · ${fmtDur(s.durationSec)}` : ''}</div>${s.notes ? `<p class="small muted">${esc(s.notes)}</p>` : ''}</div>`;
}

function dayDetail(d, today) {
  const items = itemsFor(d);
  const sessions = S.sessions.filter(s => s.date === d);
  const rec = S.recovery.find(r => r.date === d);
  const body = S.body.find(b => b.date === d);
  const planned = items.map((it, idx) => {
    const st = statusOf(it, today), lb = labelOf(it);
    const note = it.movedTo ? `Remarcado para ${fmtDate(it.movedTo)}` : it.movedFrom ? `Planejado originalmente para ${fmtDate(it.movedFrom)}` : esc(lb.sub);
    const canMove = st !== 'done' && it.type !== 'rest' && !it.movedTo;
    return `<div class="plan-row" style="--c:${TYPE_COLOR[it.type]}">
      <div class="row"><div class="grow"><b>${esc(lb.title)}</b><div class="small muted">${note}</div></div>${badge(st)}</div>
      <div class="row wrap gap">
        ${st !== 'done' && !it.movedTo ? `<a class="btn sm ${it.type}" href="${actionHref(it)}">${it.type === 'run' ? 'Correr' : it.type === 'rest' ? 'Registrar' : 'Treinar'}</a>` : ''}
        ${canMove ? `<button class="btn sm secondary" data-move="${idx}">Remarcar</button>` : ''}
        ${it.rid && st !== 'done' ? `<button class="btn sm secondary" data-undo="${idx}">Desfazer remarcação</button>` : ''}
      </div></div>`;
  }).join('');
  return `
    <h2 class="cap">${fmtDateLong(d)}</h2>
    ${planned || '<p class="muted">Nada planejado.</p>'}
    ${sessions.length ? `<h3>Registros do dia</h3>${sessions.map(sessionSummary).join('')}` : ''}
    ${rec ? `<h3>Recuperação</h3><div class="kv">
      ${rec.sleepHours ? `<span>Sono</span><b>${fmtNum(rec.sleepHours)} h (qualidade ${rec.sleepQuality || '-'}/5)</b>` : ''}
      ${rec.energy ? `<span>Disposição</span><b>${rec.energy}/5</b>` : ''}${rec.soreness ? `<span>Cansaço muscular</span><b>${rec.soreness}/5</b>` : ''}
      ${rec.painAreas?.length ? `<span>Dores</span><b>${esc(rec.painAreas.join(', '))}</b>` : ''}</div>` : ''}
    ${body ? `<h3>Corpo</h3><div class="kv">${body.weight ? `<span>Peso</span><b>${fmtNum(body.weight)} kg</b>` : ''}
      ${MEASURES.filter(m => body.measures?.[m[0]]).map(m => `<span>${m[1]}</span><b>${fmtNum(body.measures[m[0]])} cm</b>`).join('')}</div>` : ''}
    <div class="row wrap gap top">
      <a class="btn sm secondary" href="#/recuperacao?data=${d}">+ Recuperação</a>
      <a class="btn sm secondary" href="#/corpo?data=${d}">+ Peso/medidas</a>
      <a class="btn sm secondary" href="#/corrida-manual?data=${d}">+ Corrida manual</a>
      <a class="btn sm secondary" href="#/cardio?data=${d}">+ Cardio</a>
    </div>`;
}

function bindDetail(el, today) {
  const items = itemsFor(selected);
  $$('[data-move]', el).forEach(b => b.onclick = () => {
    const it = items[+b.dataset.move];
    const w = sheet(`<h2>Remarcar ${esc(labelOf(it).title)}</h2>
      <p class="small muted">O planejamento original de ${fmtDate(it.origin)} fica registrado no histórico.</p>
      <label class="field"><span>Nova data</span><input type="date" id="mv-date" value="${addDays(selected < today ? today : selected, 1)}"></label>
      <div class="row gap"><button class="btn secondary grow" data-close>Cancelar</button><button class="btn grow" id="mv-ok">Remarcar</button></div>`);
    $('#mv-ok', w).onclick = async () => {
      const to = $('#mv-date', w).value;
      if (!to) return;
      await reschedule(it, to);
      w.remove(); toast(`Remarcado para ${fmtDate(to)}`);
      selected = to; month = to.slice(0, 7); draw(el, today);
    };
  });
  $$('[data-undo]', el).forEach(b => b.onclick = async () => {
    await undoReschedule(items[+b.dataset.undo]);
    toast('Remarcação desfeita'); draw(el, today);
  });
}
