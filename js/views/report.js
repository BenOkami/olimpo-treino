// MINHA EVOLUÇÃO – relatório por período, pronto para imprimir/salvar em PDF.
import { S } from '../store.js';
import { todayISO, addDays, weekStart, fmtDate, fmtDateFull, fmtNum, fmtInt, fmtHours, fmtPace, sum, esc } from '../util.js';
import { strengthVolume, exerciseHistory, exerciseNames, weeksBack } from '../analysis.js';
import { barChart, lineChart } from '../charts.js';
import { stat, chips, bindChips } from '../ui.js';
import { MEASURES, POSES } from '../defaults.js';

const PERIODS = [['7', '7 dias'], ['30', '30 dias'], ['90', '3 meses'], ['180', '6 meses'], ['365', '1 ano'], ['all', 'Tudo']];
let period = '30';

export function render(el) {
  const today = todayISO();
  const first = [S.profile.startDate, S.sessions[0]?.date, S.body[0]?.date].filter(Boolean).sort()[0] || today;
  const from = period === 'all' ? first : addDays(today, -(+period - 1));
  const inP = x => x.date >= from && x.date <= today;
  const ses = S.sessions.filter(inP);
  const tr = ses.filter(s => s.kind !== 'rest');
  const str = ses.filter(s => s.kind === 'strength'), run = ses.filter(s => s.kind === 'run'), car = ses.filter(s => s.kind === 'cardio');
  const days = new Set(tr.map(s => s.date)).size;
  const body = S.body.filter(inP);
  const bw = S.body.filter(b => b.weight && b.date <= today);
  const wStart = [...bw].reverse().find(b => b.date <= from) || bw.find(b => b.date >= from);
  const wEnd = bw.at(-1);
  const nWeeks = Math.max(1, Math.min(26, Math.ceil(((new Date(today) - new Date(weekStart(from))) / 86400000 + 1) / 7)));
  const weeks = weeksBack(nWeeks, today);
  const perWeek = weeks.map(w => tr.filter(s => s.date >= w && s.date <= addDays(w, 6)).length);

  const exRows = exerciseNames().map(n => {
    const h = exerciseHistory(n).filter(inP);
    if (!h.length) return null;
    const best = h.reduce((m, x) => (x.topLoad > m.topLoad ? x : m), h[0]);
    return { n, a: h[0], b: h.at(-1), best };
  }).filter(Boolean).sort((x, y) => (y.b.topLoad - y.a.topLoad) - (x.b.topLoad - x.a.topLoad));

  const measureRows = MEASURES.map(([k, l]) => {
    const vals = S.body.filter(b => b.measures?.[k] && b.date <= today);
    if (!vals.length) return null;
    const a = [...vals].reverse().find(b => b.date <= from) || vals[0], b = vals.at(-1);
    return { l, a: a.measures[k], b: b.measures[k] };
  }).filter(Boolean);

  const photoRecs = S.body.filter(b => inP(b) && b.photos && Object.values(b.photos).some(Boolean));
  const pA = photoRecs[0], pB = photoRecs.at(-1);
  const pose = POSES.find(([k]) => pA?.photos?.[k] && pB?.photos?.[k])?.[0];
  const delta = (a, b, unit, d = 1) => { const x = b - a; return `${x > 0 ? '+' : x < 0 ? '−' : ''}${fmtNum(Math.abs(x), d)}${unit}`; };

  el.innerHTML = `
    <section class="card no-print">
      <div class="scroll-chips">${chips('per', PERIODS, period)}</div>
      <button class="btn block top" id="r-pdf">Exportar relatório em PDF</button>
      <p class="small muted">Na janela de impressão, escolha "Salvar como PDF".</p>
    </section>

    <div class="report">
      <header class="print-only report-head"><h1>Minha evolução</h1><p>${esc(S.profile.name)} · ${fmtDateFull(from)} a ${fmtDateFull(today)}</p></header>
      <section class="card">
        <h2>Resumo · ${fmtDate(from)} a ${fmtDate(today)}</h2>
        <div class="grid2 grid-auto">
          ${stat('Total de treinos', tr.length)}
          ${stat('Dias treinados', days)}
          ${stat('Tempo de musculação', fmtHours(sum(str.map(s => s.durationSec))))}
          ${stat('Tempo de cardio', fmtHours(sum([...car, ...run].map(s => s.durationSec))), 'corrida + cardio')}
          ${stat('Distância total', fmtNum(sum([...run, ...car].map(s => s.distanceKm || 0))) + ' km')}
          ${stat('Calorias (estimadas)', fmtInt(sum(tr.map(s => s.kcal || 0))) + ' kcal')}
          ${stat('Volume de musculação', fmtInt(sum(str.map(strengthVolume))) + ' kg')}
          ${stat('Frequência semanal', fmtNum(tr.length / Math.max(1, nWeeks), 1), 'treinos/semana')}
          ${stat('Recordes pessoais', sum(str.map(s => s.prs?.length || 0)))}
        </div>
      </section>

      <section class="card">
        <h2>Frequência semanal</h2>
        ${barChart([{ name: 'Treinos', color: 'var(--primary)', values: perWeek }], { labels: weeks.map(w => fmtDate(w)), yFmt: v => fmtNum(v, 0) })}
      </section>

      <section class="card">
        <h2>Peso e medidas</h2>
        ${wEnd ? `<div class="grid2">${stat('Peso no início', wStart ? fmtNum(wStart.weight) + ' kg' : '–', wStart ? fmtDate(wStart.date) : '')}${stat('Peso atual', fmtNum(wEnd.weight) + ' kg', wStart ? delta(wStart.weight, wEnd.weight, ' kg') : '')}</div>
          ${lineChart([{ name: 'Peso', color: 'var(--primary)', values: bw.filter(inP).map(b => b.weight) }], { labels: bw.filter(inP).map(b => fmtDate(b.date)), yFmt: v => fmtNum(v, 1) })}` : '<p class="muted small">Sem registros de peso.</p>'}
        ${measureRows.length ? `<table class="top"><thead><tr><th>Medida</th><th>Início</th><th>Atual</th><th>Diferença</th><th>%</th></tr></thead><tbody>
          ${measureRows.map(r => `<tr><td>${r.l}</td><td>${fmtNum(r.a)} cm</td><td>${fmtNum(r.b)} cm</td><td>${delta(r.a, r.b, ' cm')}</td><td>${delta(0, (r.b / r.a - 1) * 100, '%')}</td></tr>`).join('')}</tbody></table>` : ''}
        <p class="small muted">O peso sozinho não define o resultado: compare também medidas, fotos e desempenho.</p>
      </section>

      <section class="card">
        <h2>Evolução das cargas e recordes</h2>
        ${exRows.length ? `<table><thead><tr><th>Exercício</th><th>Início</th><th>Atual</th><th>Recorde</th></tr></thead><tbody>
          ${exRows.slice(0, 15).map(r => `<tr><td>${esc(r.n)}</td><td>${fmtNum(r.a.topLoad, 1)}×${r.a.topReps}</td><td>${fmtNum(r.b.topLoad, 1)}×${r.b.topReps}</td><td><b>${fmtNum(r.best.topLoad, 1)} kg</b></td></tr>`).join('')}</tbody></table>`
          : '<p class="muted small">Sem treinos de musculação no período.</p>'}
      </section>

      <section class="card">
        <h2>Corrida e cardio</h2>
        <div class="grid2 grid-auto">
          ${stat('Corridas', run.length)}${stat('Km corridos', fmtNum(sum(run.map(r => r.distanceKm))))}
          ${stat('Ritmo médio', run.length ? fmtPace(sum(run.map(r => r.durationSec)) / sum(run.map(r => r.distanceKm))) + '<small>/km</small>' : '–')}
          ${stat('Sessões de cardio', car.length)}${stat('Tempo de cardio', fmtHours(sum(car.map(s => s.durationSec))))}
          ${stat('Maior distância', run.length ? fmtNum(Math.max(...run.map(r => r.distanceKm)), 2) + ' km' : '–')}
        </div>
      </section>

      ${pose ? `<section class="card"><h2>Comparação de fotos</h2><div class="photo-cmp">
        <figure><img src="${pA.photos[pose]}" alt="Foto inicial"><figcaption>${fmtDate(pA.date)}</figcaption></figure>
        <figure><img src="${pB.photos[pose]}" alt="Foto final"><figcaption>${fmtDate(pB.date)}</figcaption></figure></div></section>` : ''}
      <p class="small muted center">Calorias são estimativas. Este relatório não substitui avaliação profissional.</p>
    </div>`;
  bindChips(el, (n, v) => { period = v; render(el); });
  el.querySelector('#r-pdf').onclick = () => window.print();
}
