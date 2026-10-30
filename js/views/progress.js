// Painel integrado de evolução (musculação + corrida + corpo) e comparação primeiro dia × qualquer data.
import { S } from '../store.js';
import { todayISO, fmtDate, fmtDateFull, fmtNum, fmtInt, fmtHours, fmtPace, sum, esc } from '../util.js';
import { insights, weeksBack, sumWeek, strengthVolume, exerciseNames, exerciseHistory, runs, strengthSessions, adherence } from '../analysis.js';
import { lineChart, barChart } from '../charts.js';
import { $, stat, insightList } from '../ui.js';
import { MEASURES, POSES } from '../defaults.js';

let exSel = null, measureSel = 'cintura', cmpDate = null;

export function render(el) {
  const today = todayISO();
  const tr = S.sessions.filter(s => s.kind !== 'rest');
  const ss = strengthSessions(), rs = runs();
  const names = exerciseNames();
  if (!exSel || !names.includes(exSel)) exSel = names[0] || null;
  const hist = exSel ? exerciseHistory(exSel) : [];
  const weeks = weeksBack(12, today), wl = weeks.map(w => fmtDate(w));
  const bodyW = S.body.filter(b => b.weight);
  const bodyM = S.body.filter(b => b.measures?.[measureSel]);
  const ad = adherence(28, today);

  el.innerHTML = `
    <section class="card">
      <h2>Visão geral</h2>
      <div class="grid2 grid-auto">
        ${stat('Sessões de musculação', ss.length)}
        ${stat('Sessões de corrida', rs.length)}
        ${stat('Km percorridos', fmtNum(sum(rs.map(r => r.distanceKm))))}
        ${stat('Tempo de cardio', fmtHours(sum(S.sessions.filter(s => s.kind === 'cardio' || s.kind === 'run').map(s => s.durationSec))), 'corrida + cardio')}
        ${stat('Horas de treino', fmtHours(sum(tr.map(s => s.durationSec))))}
        ${stat('Volume total musculação', fmtInt(sum(ss.map(strengthVolume))) + ' kg')}
        ${stat('Consistência (4 sem.)', ad.rate == null ? '–' : Math.round(ad.rate * 100) + '%', ad.planned ? `${ad.done}/${ad.planned} atividades` : '')}
      </div>
    </section>

    <div class="grid2"><a class="btn" href="#/relatorio">Relatório em PDF</a><a class="btn secondary" href="#/metas">Metas e conquistas</a></div>
    <section class="card">
      <h2>Análise inteligente</h2>
      ${insightList(insights(today))}
      <p class="small muted">Avaliação baseada nos seus registros de treino, esforço e recuperação. Não substitui orientação profissional, não diagnostica lesões ou doenças e nunca aumenta a intensidade automaticamente.</p>
    </section>

    <section class="card">
      <h2>Horas de treino por semana</h2>
      ${barChart([
        { name: 'Musculação', color: 'var(--strength)', values: weeks.map(w => sumWeek(w, s => s.durationSec / 3600, 'strength')) },
        { name: 'Corrida', color: 'var(--run)', values: weeks.map(w => sumWeek(w, s => s.durationSec / 3600, 'run')) },
      ], { labels: wl, yFmt: v => fmtNum(v, 1) + 'h' })}
    </section>

    <section class="card">
      <h2>Volume de musculação por semana (kg)</h2>
      ${barChart([{ name: 'Volume', color: 'var(--strength)', values: weeks.map(w => sumWeek(w, strengthVolume, 'strength')) }], { labels: wl, yFmt: v => v >= 1000 ? fmtNum(v / 1000, 1) + 'k' : fmtInt(v) })}
    </section>

    <section class="card">
      <h2>Evolução de cargas e repetições</h2>
      ${names.length ? `<select id="ex-sel">${names.map(n => `<option ${n === exSel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <h3>Carga máxima (kg) e 1RM estimado</h3>
        ${lineChart([
          { name: 'Carga máxima', color: 'var(--strength)', values: hist.map(h => h.topLoad) },
          { name: '1RM estimado', color: 'var(--primary)', values: hist.map(h => h.e1rm) },
        ], { labels: hist.map(h => fmtDate(h.date)), yFmt: v => fmtNum(v, 0) })}
        <h3>Repetições na carga máxima e total</h3>
        ${lineChart([
          { name: 'Reps na carga máxima', color: 'var(--run)', values: hist.map(h => h.topReps) },
          { name: 'Reps totais', color: 'var(--rest)', values: hist.map(h => h.totalReps) },
        ], { labels: hist.map(h => fmtDate(h.date)), yFmt: v => fmtNum(v, 0) })}
        ${hist.length >= 2 ? `<p class="small">Primeiro registro: <b>${fmtNum(hist[0].topLoad, 1)} kg × ${hist[0].topReps}</b> · Atual: <b>${fmtNum(hist.at(-1).topLoad, 1)} kg × ${hist.at(-1).topReps}</b></p>` : ''}`
        : '<p class="muted">Registre treinos de musculação para ver a evolução das cargas.</p>'}
    </section>

    <section class="card">
      <h2>Corrida</h2>
      <h3>Km por semana</h3>
      ${barChart([{ name: 'km', color: 'var(--run)', values: weeks.map(w => sumWeek(w, s => s.distanceKm, 'run')) }], { labels: wl, yFmt: v => fmtNum(v, v < 10 ? 1 : 0) })}
      <h3>Ritmo médio (menor é melhor)</h3>
      ${lineChart([{ name: 'Ritmo', color: 'var(--run)', values: rs.slice(-30).map(r => r.avgPaceSec) }], { labels: rs.slice(-30).map(r => fmtDate(r.date)), invert: true, yFmt: fmtPace })}
      <a class="link" href="#/corridas">Relatório completo de corrida ›</a>
    </section>

    <section class="card">
      <h2>Peso corporal (kg)</h2>
      ${lineChart([{ name: 'Peso', color: 'var(--primary)', values: bodyW.map(b => b.weight) }], { labels: bodyW.map(b => fmtDate(b.date)), yFmt: v => fmtNum(v, 1) })}
      <h3>Medidas (cm)</h3>
      <select id="m-sel">${MEASURES.map(([k, l]) => `<option value="${k}" ${k === measureSel ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${lineChart([{ name: 'Medida', color: 'var(--rest)', values: bodyM.map(b => b.measures[measureSel]) }], { labels: bodyM.map(b => fmtDate(b.date)), yFmt: v => fmtNum(v, 1) })}
      <a class="link" href="#/corpo">Registrar peso, medidas e fotos ›</a>
    </section>

    <section class="card" id="cmp">${compareHTML(today)}</section>`;

  $('#ex-sel', el)?.addEventListener('change', e => { exSel = e.target.value; render(el); });
  $('#m-sel', el).onchange = e => { measureSel = e.target.value; render(el); };
  bindCompare(el, today);
}

/* ---------- comparação: primeiro dia × data escolhida ---------- */

function firstDay() {
  const dates = [S.profile.startDate, S.sessions[0]?.date, S.body[0]?.date, S.recovery[0]?.date].filter(Boolean).sort();
  return dates[0] || todayISO();
}

function snapshot(upTo, first) {
  const body = S.body.filter(b => b.date <= upTo);
  const pick = (arr, f) => (first ? arr.find(f) : [...arr].reverse().find(f));
  const w = pick(body, b => b.weight);
  const rsAll = runs().filter(r => r.date <= upTo);
  const run = first ? rsAll[0] : rsAll.at(-1);
  const photo = pick(body, b => b.photos && Object.values(b.photos).some(Boolean));
  const measures = Object.fromEntries(MEASURES.map(([k]) => [k, pick(body, b => b.measures?.[k])?.measures[k] ?? null]));
  const tr = S.sessions.filter(s => s.kind !== 'rest' && s.date <= upTo);
  return {
    weight: w?.weight ?? null, measures, run, photo,
    sessions: tr.length, km: sum(rsAll.map(r => r.distanceKm)), hours: sum(tr.map(s => s.durationSec)),
  };
}

function compareHTML(today) {
  const f = firstDay();
  cmpDate ||= today;
  const A = snapshot(f, true), B = snapshot(cmpDate, false);
  const d = (a, b, unit, lowerBetter, dec = 1) => {
    if (a == null || b == null) return '';
    const diff = b - a;
    if (Math.abs(diff) < 1e-9) return '<span class="delta">=</span>';
    const good = lowerBetter ? diff < 0 : diff > 0;
    return `<span class="delta ${lowerBetter === null ? '' : good ? 'up' : 'down'}">${diff > 0 ? '+' : '−'}${fmtNum(Math.abs(diff), dec)}${unit}</span>`;
  };
  // Direção "boa" do peso/medidas depende do objetivo; sem objetivo claro, mostra neutro.
  const lowerGoal = ['emagrecimento', 'recomposicao'].includes(S.profile.goal) ? true : S.profile.goal === 'hipertrofia' ? false : null;
  const exRows = exerciseNames().map(n => {
    const h = exerciseHistory(n).filter(x => x.date <= cmpDate);
    return h.length ? { n, a: h[0], b: h.at(-1) } : null;
  }).filter(Boolean).slice(0, 8);
  const row = (label, a, b, delta) => `<tr><td>${label}</td><td>${a}</td><td>${b}</td><td>${delta}</td></tr>`;
  const ph = (snap, pose) => snap.photo?.photos?.[pose];
  const pose = POSES.find(([k]) => ph(A, k) && ph(B, k))?.[0] || POSES.find(([k]) => ph(B, k))?.[0];

  return `
    <h2>Comparar: primeiro dia × data</h2>
    <div class="row gap"><div class="grow small muted">Primeiro dia: <b>${fmtDateFull(f)}</b></div>
      <input type="date" id="cmp-date" value="${cmpDate}" min="${f}" style="width:auto"></div>
    ${pose ? `<div class="photo-cmp top">
      <figure>${ph(A, pose) ? `<img src="${ph(A, pose)}" alt="Foto inicial">` : '<div class="ph-empty">Sem foto</div>'}<figcaption>${fmtDate(A.photo?.date)}</figcaption></figure>
      <figure><img src="${ph(B, pose)}" alt="Foto mais recente"><figcaption>${fmtDate(B.photo?.date)}</figcaption></figure></div>` : ''}
    <table class="top"><thead><tr><th></th><th>Início</th><th>${fmtDate(cmpDate)}</th><th>Δ</th></tr></thead><tbody>
      ${row('Peso', A.weight ? fmtNum(A.weight) + ' kg' : '–', B.weight ? fmtNum(B.weight) + ' kg' : '–', d(A.weight, B.weight, ' kg', lowerGoal))}
      ${MEASURES.filter(([k]) => A.measures[k] || B.measures[k]).map(([k, l]) => row(l, A.measures[k] ? fmtNum(A.measures[k]) : '–', B.measures[k] ? fmtNum(B.measures[k]) : '–', d(A.measures[k], B.measures[k], ' cm', lowerGoal === null ? null : (k === 'peito' || k.startsWith('braco') || k.startsWith('coxa') || k === 'panturrilha') ? false : lowerGoal))).join('')}
      ${A.run && B.run ? row('Corrida: distância', fmtNum(A.run.distanceKm, 2) + ' km', fmtNum(B.run.distanceKm, 2) + ' km', d(A.run.distanceKm, B.run.distanceKm, ' km', false, 2)) +
        row('Corrida: ritmo', fmtPace(A.run.avgPaceSec), fmtPace(B.run.avgPaceSec), A.run.avgPaceSec && B.run.avgPaceSec ? `<span class="delta ${B.run.avgPaceSec < A.run.avgPaceSec ? 'up' : 'down'}">${B.run.avgPaceSec < A.run.avgPaceSec ? '−' : '+'}${fmtPace(Math.abs(B.run.avgPaceSec - A.run.avgPaceSec))}</span>` : '') : ''}
      ${exRows.map(x => row(esc(x.n), `${fmtNum(x.a.topLoad, 1)}×${x.a.topReps}`, `${fmtNum(x.b.topLoad, 1)}×${x.b.topReps}`, d(x.a.topLoad, x.b.topLoad, ' kg', false))).join('')}
      ${row('Sessões acumuladas', '0', B.sessions, '')}
      ${row('Km acumulados', '0', fmtNum(B.km), '')}
      ${row('Horas acumuladas', '0', fmtHours(B.hours), '')}
    </tbody></table>`;
}

function bindCompare(el, today) {
  $('#cmp-date', el).onchange = e => {
    cmpDate = e.target.value || today;
    $('#cmp', el).innerHTML = compareHTML(today);
    bindCompare(el, today);
  };
}
