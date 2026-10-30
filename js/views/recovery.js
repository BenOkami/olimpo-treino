// Acompanhamento de recuperação: sono, disposição, cansaço, dores e esforço percebido.
import { S, put, del } from '../store.js';
import { todayISO, fmtDate, fmtNum, num, esc, toast } from '../util.js';
import { recoveryInsights } from '../analysis.js';
import { lineChart } from '../charts.js';
import { $, chips, bindChips, chipVal, scale, field, insightList } from '../ui.js';
import { PAIN_AREAS } from '../defaults.js';

const LBL = {
  sleepQuality: ['Muito ruim', 'Ruim', 'Regular', 'Boa', 'Ótima'],
  energy: ['Muito baixa', 'Baixa', 'Normal', 'Boa', 'Excelente'],
  soreness: ['Nenhum', 'Leve', 'Moderado', 'Alto', 'Muito alto'],
};
const opts = k => LBL[k].map((l, i) => [i + 1, `${i + 1} · ${l}`]);

export function render(el, p) {
  const date = p.data || todayISO();
  const r = S.recovery.find(x => x.date === date) || { date, painAreas: [] };
  const trainedRpe = S.sessions.filter(s => s.date === date && s.kind !== 'rest' && s.rpe).map(s => s.rpe);
  const ins = recoveryInsights(todayISO());
  const last = S.recovery.slice(-30);

  el.innerHTML = `
    <section class="card">
      <h2>Como você está?</h2>
      ${field('Data', `<input type="date" id="r-date" value="${date}">`)}
      <div class="grid2">
        ${field('Horas dormidas', `<input type="number" inputmode="decimal" step="0.5" id="r-sleep" value="${r.sleepHours ?? ''}" placeholder="7,5">`)}
      </div>
      <div class="field"><span>Qualidade do sono</span>${chips('sleepQuality', opts('sleepQuality'), r.sleepQuality)}</div>
      <div class="field"><span>Nível de disposição</span>${chips('energy', opts('energy'), r.energy)}</div>
      <div class="field"><span>Cansaço muscular</span>${chips('soreness', opts('soreness'), r.soreness)}</div>
      <div class="field"><span>Dores relatadas</span>${chips('pain', [['nenhuma', 'Nenhuma'], ...PAIN_AREAS], r.painAreas, true)}</div>
      <div class="grid2">
        ${field('Intensidade da dor (0–10)', `<input type="number" min="0" max="10" inputmode="numeric" id="r-painlvl" value="${r.painLevel ?? ''}">`)}
      </div>
      ${field('Descrição da dor (opcional)', `<input id="r-paindesc" value="${esc(r.painNotes || '')}">`)}
      <div class="field"><span>Percepção de esforço após o treino (1–10)</span>${chips('rpe', scale(10), r.rpe ?? trainedRpe.at(-1))}</div>
      ${field('Observações', `<textarea id="r-notes" rows="2">${esc(r.notes || '')}</textarea>`)}
      <div class="row gap">${r.id ? '<button class="btn danger" id="r-del">Excluir</button>' : ''}<button class="btn rest grow" id="r-save">Salvar</button></div>
    </section>

    <section class="card">
      <h2>Status da recuperação (7 dias)</h2>
      ${ins.length ? insightList(ins) : insightList([{ level: 'ok', title: 'Sem sinais de alerta', text: S.recovery.length ? 'Seus registros recentes não indicam recuperação insuficiente.' : 'Registre sono e disposição para contextualizar os relatórios.' }])}
      <p class="small muted">Estas informações servem para contextualizar seus treinos. O app não diagnostica lesões ou doenças. Em caso de dor persistente, procure um profissional de saúde.</p>
    </section>

    <section class="card">
      <h2>Sono e disposição</h2>
      ${lineChart([
        { name: 'Horas de sono', color: 'var(--primary)', values: last.map(x => x.sleepHours ?? null) },
        { name: 'Disposição (1–5)', color: 'var(--rest)', values: last.map(x => x.energy ?? null) },
        { name: 'Cansaço (1–5)', color: 'var(--warn)', values: last.map(x => x.soreness ?? null) },
      ], { labels: last.map(x => fmtDate(x.date)), yFmt: v => fmtNum(v, 0) })}
    </section>

    <section class="card">
      <h2>Histórico</h2>
      ${S.recovery.length ? `<table><thead><tr><th>Data</th><th>Sono</th><th>Disp.</th><th>Cans.</th><th>Dor</th></tr></thead><tbody>
        ${S.recovery.slice().reverse().slice(0, 40).map(x => `<tr><td><a href="#/recuperacao?data=${x.date}">${fmtDate(x.date)}</a></td><td>${x.sleepHours ? fmtNum(x.sleepHours) + 'h' : '–'}</td><td>${x.energy || '–'}</td><td>${x.soreness || '–'}</td><td>${x.painAreas?.filter(a => a !== 'nenhuma').length ? esc(x.painAreas.join(', ')) : '–'}</td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">Nenhum registro ainda.</p>'}
    </section>`;

  // "Nenhuma" é exclusiva: escolher uma área desmarca "Nenhuma" e vice-versa
  const painGroup = el.querySelector('[data-chips="pain"]');
  let lastPain = null;
  painGroup.addEventListener('click', e => { lastPain = e.target.closest('.chip')?.dataset.v; }, true);
  bindChips(el, (n, v) => {
    if (n !== 'pain' || !v.includes('nenhuma') || v.length < 2) return;
    painGroup.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('on', lastPain === 'nenhuma' ? c.dataset.v === 'nenhuma' : c.classList.contains('on') && c.dataset.v !== 'nenhuma');
    });
  });
  $('#r-date', el).onchange = e => { location.hash = '#/recuperacao?data=' + e.target.value; };
  $('#r-save', el).onclick = async () => {
    const obj = {
      ...r, date: $('#r-date', el).value || date,
      sleepHours: num($('#r-sleep', el).value),
      sleepQuality: +chipVal(el, 'sleepQuality') || null,
      energy: +chipVal(el, 'energy') || null,
      soreness: +chipVal(el, 'soreness') || null,
      painAreas: chipVal(el, 'pain'),
      painLevel: num($('#r-painlvl', el).value),
      painNotes: $('#r-paindesc', el).value,
      rpe: +chipVal(el, 'rpe') || null,
      notes: $('#r-notes', el).value,
    };
    await put('recovery', obj);
    toast('Recuperação registrada');
    render(el, { data: obj.date });
  };
  $('#r-del', el)?.addEventListener('click', async () => {
    if (!confirm('Excluir este registro?')) return;
    await del('recovery', r.id); render(el, {});
  });
}
