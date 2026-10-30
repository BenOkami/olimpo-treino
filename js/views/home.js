// Tela inicial: programação da semana, progresso, análise e gráficos separados.
import { S } from '../store.js';
import { todayISO, weekStart, addDays, DAY_SHORT, fmtDate, fmtNum, fmtHours, fmtInt, esc } from '../util.js';
import { itemsFor, statusOf, labelOf, actionHref, weekProgress } from '../schedule.js';
import { insights, weeksBack, sumWeek, strengthVolume } from '../analysis.js';
import { barChart } from '../charts.js';
import { stat, badge, insightList, TYPE_COLOR, icon } from '../ui.js';
import { GOALS, GREEK_QUOTES } from '../defaults.js';

const firstName = n => { const f = (n || '').trim().split(/\s+/)[0] || ''; return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase(); };
// Uma frase por dia, sempre a mesma durante o dia
const quoteOfDay = () => GREEK_QUOTES[Math.floor(Date.now() / 86400000) % GREEK_QUOTES.length];

const CTA = { strength: ['Treinar', 'strength'], run: ['Correr', 'run'], rest: ['Registrar', 'rest'] };

function ring(done, total, color) {
  const r = 34, c = 2 * Math.PI * r, f = total ? Math.min(1, done / total) : 0;
  return `<div class="ring"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--chip)" stroke-width="9"/>
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}"/></svg>
    <b>${done}/${total}</b></div>`;
}

// Conclusões da semana por modalidade (itens planejados, sem descanso)
function weekByType(ws) {
  const out = { strength: [0, 0], run: [0, 0] };
  for (let i = 0; i < 7; i++) {
    for (const it of itemsFor(addDays(ws, i))) {
      if (it.movedTo || !out[it.type]) continue;
      out[it.type][1]++;
      if (statusOf(it) === 'done') out[it.type][0]++;
    }
  }
  return out;
}

export function render(el) {
  const today = todayISO(), ws = weekStart(today);
  const { total, done } = weekProgress(ws);
  const pct = total ? Math.round(done / total * 100) : 0;
  const goal = GOALS.find(g => g[0] === S.profile.goal)?.[1];
  const byType = weekByType(ws);

  const rows = [...Array(7)].map((_, i) => {
    const d = addDays(ws, i);
    const items = itemsFor(d);
    if (!items.length) return `<div class="week-item"><div class="dayname"><b>${DAY_SHORT[i]}</b><span>${fmtDate(d)}</span></div><div class="grow muted">Livre</div></div>`;
    return items.map(it => {
      const st = statusOf(it, today), lb = labelOf(it);
      const note = it.movedTo ? `Remarcado para ${fmtDate(it.movedTo)}` : it.movedFrom ? `Remarcado de ${fmtDate(it.movedFrom)}` : esc(lb.sub);
      const btn = st === 'done' ? `<a class="btn sm secondary" href="${actionHref(it)}">Ver</a>`
        : it.movedTo ? '' : `<a class="btn sm ${CTA[it.type][1]}" href="${actionHref(it)}">${CTA[it.type][0]}</a>`;
      return `<div class="week-item ${d === today ? 'is-today' : ''}">
        <div class="dayname"><b>${DAY_SHORT[i]}</b><span>${fmtDate(d)}</span></div>
        <i class="bar" style="background:${TYPE_COLOR[it.type]}"></i>
        <div class="grow"><b class="god">${esc(lb.title)}</b><div class="small muted">${note}</div></div>
        <div class="end">${it.type !== 'rest' || st === 'done' ? badge(st) : ''}${btn}</div>
      </div>`;
    }).join('');
  }).join('');

  const todayItem = itemsFor(today).find(i => !i.movedTo && statusOf(i, today) !== 'done');
  const weeks = weeksBack(8, today);
  const labels = weeks.map(w => fmtDate(w));
  const kmW = weeks.map(w => sumWeek(w, s => s.distanceKm, 'run'));
  const volW = weeks.map(w => sumWeek(w, strengthVolume, 'strength'));
  const weekSec = sumWeek(ws, s => s.durationSec);
  const weekKm = sumWeek(ws, s => s.distanceKm, 'run');
  const weekVol = sumWeek(ws, strengthVolume, 'strength');
  const ins = insights(today).slice(0, 3);

  el.innerHTML = `
    <section class="hero">
      <div class="small">Salve${S.profile.name ? ', ' + esc(firstName(S.profile.name)) : ''} · ${esc(goal || '')}</div>
      <div class="quote">“${esc(quoteOfDay()[0])}” <small>— ${esc(quoteOfDay()[1])}</small></div>
      <div class="hero-num"><b>${done}</b> de ${total} atividades concluídas</div>
      <div class="rings">
        <div>${ring(done, total, 'var(--text)')}<span>Semana</span></div>
        <div>${ring(byType.strength[0], byType.strength[1], 'var(--strength)')}<span>Musculação</span></div>
        <div>${ring(byType.run[0], byType.run[1], 'var(--run)')}<span>Corrida</span></div>
      </div>
      <div class="small">Semana de ${fmtDate(ws)} a ${fmtDate(addDays(ws, 6))} · ${pct}%</div>
    </section>

    ${todayItem ? `<a class="card today-card" href="${actionHref(todayItem)}" style="--c:${TYPE_COLOR[todayItem.type]}">
      <div class="small muted">Hoje</div>
      <div class="row"><div class="grow"><h2>${esc(labelOf(todayItem).title)}</h2><div class="small muted">${esc(labelOf(todayItem).sub)}</div></div>
      <span class="btn ${CTA[todayItem.type][1]}">${CTA[todayItem.type][0]} ${icon('chevron')}</span></div></a>` : ''}

    <div class="quick">
      <a href="#/cardio"><span>❤</span>Cardio</a><a href="#/biblioteca"><span>📖</span>Exercícios</a>
      <a href="#/relatorio"><span>📄</span>Relatório</a>
    </div>
    <section class="card">
      <div class="row"><h2 class="grow">Programação da semana</h2><a class="small" href="#/calendario">Calendário</a><a class="small" href="#/plano">Editar</a></div>
      ${rows}
    </section>

    <section class="card">
      <h2>Esta semana</h2>
      <div class="grid2">
        ${stat('Tempo de treino', fmtHours(weekSec))}
        ${stat('Quilômetros', fmtNum(weekKm) + ' km')}
        ${stat('Volume musculação', fmtInt(weekVol) + ' kg')}
        ${stat('Sessões', S.sessions.filter(s => s.kind !== 'rest' && s.date >= ws && s.date <= today).length)}
      </div>
    </section>

    <section class="card">
      <div class="row"><h2 class="grow">Análise de carga e recuperação</h2><a class="small" href="#/evolucao">Relatório</a></div>
      ${insightList(ins)}
    </section>

    <section class="card">
      <h2><span class="dot" style="background:var(--run)"></span> Corrida · km por semana</h2>
      ${barChart([{ name: 'km', color: 'var(--run)', values: kmW }], { labels, yFmt: v => fmtNum(v, v < 10 ? 1 : 0) })}
    </section>
    <section class="card">
      <h2><span class="dot" style="background:var(--strength)"></span> Musculação · volume por semana (kg)</h2>
      ${barChart([{ name: 'kg', color: 'var(--strength)', values: volW }], { labels, yFmt: v => v >= 1000 ? fmtNum(v / 1000, 1) + 'k' : fmtInt(v) })}
    </section>
    <a class="btn block secondary" href="#/evolucao">Ver relatório geral de evolução</a>
  `;
}
