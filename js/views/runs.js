// MINHAS CORRIDAS: relatório de evolução, detalhes de cada corrida e registro manual.
import { S, put, del } from '../store.js';
import { todayISO, fmtDate, fmtDateFull, fmtDur, fmtPace, fmtNum, fmtInt, fmtHours, parseDur, num, esc, toast, runKcal, weekStart, addDays } from '../util.js';
import { pendingItemFor } from '../schedule.js';
import { runs, runTotals, bestEffort, firstVsLatest, runSuggestion, weeksBack, sumWeek, latestWeight } from '../analysis.js';
import { lineChart, barChart, routeSvg } from '../charts.js';
import { $, $$, stat, chips, bindChips, chipVal, scale, field } from '../ui.js';
import { MODALITIES } from '../defaults.js';
import { isLive, liveSummary } from './tracker.js';
import * as strava from '../strava.js';
const { autoSend } = strava;

const modName = m => MODALITIES.find(x => x[0] === m)?.[1] || m || '';
const delta = (v, good, txt) => `<span class="delta ${v === 0 ? '' : good ? 'up' : 'down'}">${txt}</span>`;

let filter = 'all';

export function renderList(el) {
  const t = runTotals();
  const all = runs();
  const list = filter === 'all' ? all : all.filter(r => r.runType === filter);
  const cmp = firstVsLatest();
  const sug = runSuggestion();
  const weeks = weeksBack(12);
  const efforts = [1, 3, 5, 10].map(k => [k, bestEffort(k)]);
  const series = list.slice(-30);
  const lbl = series.map(r => fmtDate(r.date));
  const enduranceRuns = all.filter(r => r.runType === 'A').slice(-30);

  el.innerHTML = `
    ${isLive() ? `<a class="card live-card" href="#/correr"><b>Corrida em andamento</b><span>${liveSummary()}</span></a>` : ''}
    <section class="card head-card" style="--c:var(--run)">
      <h2>Minhas corridas</h2>
      <div class="grid2">
        <a class="btn run big" href="#/correr?tipo=A"><span class="god">Corrida A</span><small>Resistência</small></a>
        <a class="btn run big alt" href="#/correr?tipo=B"><span class="god">Corrida B</span><small>Velocidade</small></a>
      </div>
      <a class="btn secondary block top" href="#/corrida-manual">Registrar corrida manualmente</a>
      ${strava.connected() ? '<button class="btn strava block top" id="s-import">Importar corridas do Strava</button>' : '<a class="small top strava-link" href="#/perfil">Conectar ao Strava ›</a>'}
    </section>

    <section class="card">
      <h2>Resumo</h2>
      <div class="grid2 grid-auto">
        ${stat('Km na semana', fmtNum(t.weekKm))}
        ${stat('Km no mês', fmtNum(t.monthKm))}
        ${stat('Tempo total correndo', fmtHours(t.totalSec))}
        ${stat('Ritmo médio', fmtPace(t.avgPace) + '<small>/km</small>')}
        ${stat('Melhor ritmo', fmtPace(t.bestPace) + '<small>/km</small>')}
        ${stat('Maior distância', t.longest ? fmtNum(t.longest.distanceKm, 2) + ' km' : '–', t.longest ? fmtDate(t.longest.date) : '')}
      </div>
    </section>

    <section class="card">
      <h2>Melhores tempos</h2>
      <div class="grid2 grid-auto">${efforts.map(([k, b]) => stat(`${k} km`, b ? fmtDur(b.sec) : '–', b ? `${fmtPace(b.sec / k)}/km · ${fmtDate(b.date)}` : 'registros insuficientes')).join('')}</div>
      <p class="small muted">Calculados pelas parciais por km (cronômetro/GPS) ou por corridas com a distância exata.</p>
    </section>

    ${cmp ? `<section class="card">
      <h2>Primeira corrida × mais recente</h2>
      <div class="compare">
        <div><div class="small muted">Primeira · ${fmtDate(cmp.first.date)}</div>
          <div class="kv"><span>Distância</span><b>${fmtNum(cmp.first.distanceKm, 2)} km</b><span>Tempo</span><b>${fmtDur(cmp.first.durationSec)}</b><span>Ritmo</span><b>${fmtPace(cmp.first.avgPaceSec)}/km</b></div></div>
        <div><div class="small muted">Mais recente · ${fmtDate(cmp.latest.date)}</div>
          <div class="kv"><span>Distância</span><b>${fmtNum(cmp.latest.distanceKm, 2)} km</b><span>Tempo</span><b>${fmtDur(cmp.latest.durationSec)}</b><span>Ritmo</span><b>${fmtPace(cmp.latest.avgPaceSec)}/km</b></div></div>
      </div>
      <ul class="result">
        <li>${delta(cmp.distPct, cmp.distPct > 0, `${cmp.distPct >= 0 ? 'Aumento' : 'Redução'} de ${fmtNum(Math.abs(cmp.distPct), 0)}% na distância`)}</li>
        <li>${delta(cmp.paceDiff, cmp.paceDiff > 0, `${cmp.paceDiff >= 0 ? 'Melhora' : 'Piora'} de ${fmtPace(Math.abs(cmp.paceDiff))} min/km no ritmo`)}</li>
        <li>${delta(cmp.speedPct, cmp.speedPct > 0, `Velocidade média ${cmp.speedPct >= 0 ? '+' : '−'}${fmtNum(Math.abs(cmp.speedPct), 0)}%`)}</li>
      </ul>
    </section>` : ''}

    <section class="card">
      <h2>Progressão sugerida</h2>
      <ul class="plain">${sug.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <p class="small muted">Sugestões graduais baseadas no seu histórico e nível. Nada é aplicado automaticamente — ajuste as metas em <a href="#/plano">Plano semanal</a>.</p>
    </section>

    <section class="card">
      <h2>Quilômetros por semana</h2>
      ${barChart([{ name: 'km', color: 'var(--run)', values: weeks.map(w => sumWeek(w, s => s.distanceKm, 'run')) }], { labels: weeks.map(w => fmtDate(w)), yFmt: v => fmtNum(v, v < 10 ? 1 : 0) })}
    </section>

    <section class="card">
      <div class="row"><h2 class="grow">Evolução</h2>${chips('rf', [['all', 'Todas'], ['A', 'A'], ['B', 'B']], filter)}</div>
      <h3>Ritmo médio (min/km · menor é melhor)</h3>
      ${lineChart([{ name: 'Ritmo', color: 'var(--run)', values: series.map(r => r.avgPaceSec) }], { labels: lbl, invert: true, yFmt: fmtPace })}
      <h3>Velocidade média (km/h)</h3>
      ${lineChart([{ name: 'Velocidade', color: 'var(--primary)', values: series.map(r => r.avgSpeed) }], { labels: lbl, yFmt: v => fmtNum(v, 1) })}
      <h3>Resistência · Corrida A (distância e duração)</h3>
      ${lineChart([
        { name: 'Distância (km)', color: 'var(--run)', values: enduranceRuns.map(r => r.distanceKm) },
        { name: 'Duração (×10 min)', color: 'var(--rest)', values: enduranceRuns.map(r => r.durationSec / 600) },
      ], { labels: enduranceRuns.map(r => fmtDate(r.date)), yFmt: v => fmtNum(v, 1) })}
    </section>

    <section class="card">
      <h2>Histórico (${list.length})</h2>
      ${list.length ? list.slice().reverse().map(r => `<a class="list-link" href="#/corrida/${r.id}">
        <span class="tag" style="--c:var(--run)">${esc(r.runType)}</span>
        <div class="grow"><b>${fmtNum(r.distanceKm, 2)} km · ${fmtDur(r.durationSec)}</b><div class="small muted">${fmtDateFull(r.date)} · ${esc(modName(r.modality))} · ${fmtPace(r.avgPaceSec)}/km</div></div>
        <span class="muted">›</span></a>`).join('') : '<p class="muted">Nenhuma corrida registrada ainda.</p>'}
    </section>`;
  bindChips(el, (n, v) => { filter = v; renderList(el); });
  $('#s-import', el)?.addEventListener('click', async e => {
    e.target.disabled = true; e.target.textContent = 'Buscando no Strava…';
    try { const n = await strava.importRuns(); toast(n ? `${n} corrida(s) importada(s) do Strava` : 'Nenhuma corrida nova no Strava'); renderList(el); }
    catch (err) { toast(`Strava: ${err.message}`); e.target.disabled = false; e.target.textContent = 'Importar corridas do Strava'; }
  });
}

export function renderDetail(el, p) {
  const r = S.sessions.find(s => s.id === p.arg);
  if (!r) { el.innerHTML = '<p class="card">Corrida não encontrada.</p>'; return; }
  const tpl = S.templates.run[r.runType];
  el.innerHTML = `
    ${p.novo ? '<div class="insight ok"><span class="ico">✓</span><div><b>Corrida salva no histórico</b><p>Complete as informações abaixo se quiser (esforço, frequência cardíaca, observações).</p></div></div>' : ''}
    <section class="card head-card" style="--c:var(--run)">
      <div class="small muted">${fmtDateFull(r.date)} · ${esc(modName(r.modality))}${r.source === 'cronometro' ? ' · cronômetro' : ' · manual'}</div>
      <h2>${esc(tpl?.name || 'Corrida ' + r.runType)}</h2>
      <div class="grid2 grid-auto">
        ${stat('Distância', fmtNum(r.distanceKm, 2) + ' km')}
        ${stat('Tempo total', fmtDur(r.durationSec))}
        ${stat('Ritmo médio', fmtPace(r.avgPaceSec) + '<small>/km</small>')}
        ${stat('Velocidade média', fmtNum(r.avgSpeed) + ' km/h')}
        ${stat('Melhor ritmo', fmtPace(r.bestPaceSec) + '<small>/km</small>')}
        ${stat('Calorias (est.)', fmtInt(r.kcal) + ' kcal')}
        ${stat('FC média', r.hrAvg ? r.hrAvg + ' bpm' : '–', r.hrMax ? 'máx. ' + r.hrMax : '')}
        ${stat('Esforço', r.rpe ? r.rpe + '/10' : '–')}
      </div>
    </section>
    ${strava.connected() || r.strava?.activityId ? `<section class="card strava-row">
      <span class="strava-mark">S</span>
      <div class="grow small">${r.strava?.activityId ? `${r.source === 'strava' ? 'Importada do Strava' : 'Enviada ao Strava'} ✓` : r.strava?.uploadId ? 'Enviada, o Strava ainda está processando' : 'Ainda não enviada ao Strava'}</div>
      ${r.strava?.activityId ? `<a class="btn sm secondary" href="${strava.activityUrl(r.strava.activityId)}" target="_blank" rel="noopener">Ver no Strava</a>` : `<button class="btn sm strava" id="d-strava">Enviar</button>`}
    </section>` : ''}
    ${r.route?.length > 1 ? `<section class="card"><h2>Trajeto</h2>${routeSvg(r.route)}<div class="legend"><span><i class="dot" style="background:var(--ok)"></i>Início</span><span><i class="dot" style="background:var(--danger)"></i>Fim</span></div></section>` : ''}
    ${r.splits?.length ? `<section class="card"><h2>Parciais por km</h2>${splitBars(r.splits)}</section>` : ''}
    ${r.intervals?.length ? `<section class="card"><h2>Intervalos</h2><table><thead><tr><th>#</th><th>Tiro</th><th>Recuperação</th><th>Distância</th><th>Ritmo</th></tr></thead><tbody>
      ${r.intervals.map(i => `<tr><td>${i.n}</td><td>${fmtDur(i.workSec)}</td><td>${i.recSec ? fmtDur(i.recSec) : '–'}</td><td>${i.distM ? fmtInt(i.distM) + ' m' : '–'}</td><td>${fmtPace(i.paceSec)}</td></tr>`).join('')}</tbody></table></section>` : ''}
    ${r.laps?.length ? `<section class="card"><h2>Voltas</h2><table><thead><tr><th>Volta</th><th>Tempo</th><th>Distância</th></tr></thead><tbody>
      ${r.laps.map(l => `<tr><td>${l.n}</td><td>${fmtDur(l.sec)}</td><td>${fmtNum(l.distM / 1000, 2)} km</td></tr>`).join('')}</tbody></table></section>` : ''}
    <section class="card">
      <h2>Ajustar dados</h2>
      <div class="grid2">
        ${field('Distância (km)', `<input type="number" inputmode="decimal" step="0.01" id="d-km" value="${r.distanceKm}">`)}
        ${field('Tempo (h:mm:ss)', `<input id="d-time" value="${fmtDur(r.durationSec)}">`)}
        ${field('FC média (bpm)', `<input type="number" inputmode="numeric" id="d-hr" value="${r.hrAvg ?? ''}">`)}
        ${field('FC máxima (bpm)', `<input type="number" inputmode="numeric" id="d-hrmax" value="${r.hrMax ?? ''}">`)}
      </div>
      <div class="field"><span>Percepção de esforço</span>${chips('rpe', scale(10), r.rpe)}</div>
      ${field('Observações', `<textarea id="d-notes" rows="2">${esc(r.notes || '')}</textarea>`)}
      <div class="row gap"><button class="btn danger" id="d-del">Excluir</button><button class="btn run grow" id="d-save">Salvar alterações</button></div>
    </section>`;
  bindChips(el);
  $('#d-save', el).onclick = async () => {
    const km = num($('#d-km', el).value) || 0, sec = parseDur($('#d-time', el).value);
    Object.assign(r, computeRun(km, sec, r.date), {
      hrAvg: num($('#d-hr', el).value), hrMax: num($('#d-hrmax', el).value),
      rpe: +chipVal(el, 'rpe') || null, notes: $('#d-notes', el).value,
    });
    if (!r.splits?.length && !r.intervals?.length) r.bestPaceSec = r.avgPaceSec;
    await put('sessions', r); toast('Corrida atualizada');
    location.hash = '#/corridas';
  };
  $('#d-strava', el)?.addEventListener('click', async e => {
    e.target.disabled = true; e.target.textContent = 'Enviando…';
    try { await strava.sendToStrava(r); toast('Enviada ao Strava ✓'); renderDetail(el, { arg: r.id }); }
    catch (err) { toast(`Strava: ${err.message}`); e.target.disabled = false; e.target.textContent = 'Enviar'; }
  });
  $('#d-del', el).onclick = async () => {
    if (!confirm('Excluir esta corrida do histórico?')) return;
    await del('sessions', r.id); toast('Corrida excluída'); location.hash = '#/corridas';
  };
}

function splitBars(splits) {
  const max = Math.max(...splits.map(s => s.sec)), min = Math.min(...splits.map(s => s.sec));
  return splits.map(s => `<div class="split"><span>${s.km}</span><div class="sbar"><i style="width:${(s.sec / max * 100).toFixed(0)}%;${s.sec === min ? 'background:var(--ok)' : ''}"></i></div><b>${fmtPace(s.sec)}</b></div>`).join('');
}

function computeRun(km, sec, date) {
  return {
    distanceKm: km, durationSec: Math.round(sec),
    avgPaceSec: km > 0 ? sec / km : null, avgSpeed: km > 0 && sec > 0 ? km / (sec / 3600) : 0,
    kcal: Math.round(runKcal(latestWeight(date) || 70, km)),
  };
}

export function renderManual(el, p) {
  const date = p.data || todayISO();
  const type = p.tipo === 'B' ? 'B' : 'A';
  const tplB = S.templates.run.B;
  el.innerHTML = `
    <section class="card head-card" style="--c:var(--run)">
      <h2>Registrar corrida</h2>
      <p class="small muted">Use para corridas na esteira ou feitas sem o cronômetro do app.</p>
      <div class="field"><span>Tipo</span>${chips('type', [['A', 'A · Resistência'], ['B', 'B · Velocidade']], type)}</div>
      <div class="field"><span>Modalidade</span>${chips('mod', MODALITIES, p.modalidade || 'esteira')}</div>
      <div class="grid2">
        ${field('Data', `<input type="date" id="m-date" value="${date}">`)}
        ${field('Distância (km)', `<input type="number" inputmode="decimal" step="0.01" id="m-km" placeholder="5,00">`)}
        ${field('Tempo total (h:mm:ss)', `<input id="m-time" placeholder="30:00">`)}
        ${field('FC média (opcional)', `<input type="number" inputmode="numeric" id="m-hr">`)}
      </div>
      <div id="m-b" ${type === 'B' ? '' : 'hidden'}>
        <h3>Intervalos</h3>
        <div class="grid2">
          ${field('Quantidade de tiros', `<input type="number" inputmode="numeric" id="m-n" value="${tplB.intervals}">`)}
          ${field('Tempo de cada tiro (s)', `<input type="number" inputmode="numeric" id="m-work" value="${tplB.workSec}">`)}
          ${field('Recuperação (s)', `<input type="number" inputmode="numeric" id="m-rec" value="${tplB.recSec}">`)}
          ${field('Melhor ritmo (min:ss/km)', `<input id="m-best" placeholder="5:00">`)}
        </div>
      </div>
      ${field('Tempos por km (opcional, um por linha: 6:10)', `<textarea id="m-splits" rows="3" placeholder="6:10&#10;6:02&#10;5:55"></textarea>`)}
      <div class="field"><span>Percepção de esforço</span>${chips('rpe', scale(10), null)}</div>
      ${field('Observações', '<textarea id="m-notes" rows="2"></textarea>')}
      <button class="btn run block" id="m-save">Salvar corrida</button>
    </section>`;
  bindChips(el, (n, v) => { if (n === 'type') $('#m-b', el).hidden = v !== 'B'; });
  $('#m-save', el).onclick = async () => {
    const km = num($('#m-km', el).value) || 0, sec = parseDur($('#m-time', el).value);
    if (!km || !sec) { toast('Informe distância e tempo'); return; }
    const d = $('#m-date', el).value || todayISO();
    const runType = chipVal(el, 'type');
    const splits = $('#m-splits', el).value.split(/\n+/).map(s => s.trim()).filter(Boolean).map((s, i) => ({ km: i + 1, sec: parseDur(s) })).filter(s => s.sec > 0);
    const r = {
      kind: 'run', date: d, runType, ref: runType, modality: chipVal(el, 'mod'),
      planDate: p.plan || pendingItemFor('run', d)?.origin || null,
      ...computeRun(km, sec, d), splits, laps: [], route: [],
      hrAvg: num($('#m-hr', el).value), rpe: +chipVal(el, 'rpe') || null, notes: $('#m-notes', el).value, source: 'manual',
    };
    if (runType === 'B') {
      const n = num($('#m-n', el).value) || 0, w = num($('#m-work', el).value) || 0, rc = num($('#m-rec', el).value) || 0;
      r.intervals = [...Array(n)].map((_, i) => ({ n: i + 1, workSec: w, recSec: rc, distM: 0, paceSec: null }));
    }
    const best = parseDur($('#m-best', el).value);
    r.bestPaceSec = Math.min(...[best || Infinity, ...splits.map(s => s.sec), r.avgPaceSec]);
    const saved = await put('sessions', r);
    autoSend(saved);
    toast('Corrida salva');
    location.hash = `#/corrida/${saved.id}`;
  };
}
