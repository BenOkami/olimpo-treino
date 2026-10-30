// Edição da semana, dos treinos (exercícios) e das metas de corrida + planejamento inteligente.
import { S, setKV, savePlan, currentDays } from '../store.js';
import { DAY_NAMES, uid, num, esc, toast, fmtPace, parseDur } from '../util.js';
import { runSuggestion, goalRepNote } from '../analysis.js';
import { $, $$, field } from '../ui.js';
import { pickExercise } from './library.js';

export function render(el) {
  const days = structuredClone(currentDays());
  const tpl = structuredClone(S.templates);
  const sug = runSuggestion();

  const refOptions = type => type === 'strength'
    ? Object.entries(tpl.strength).map(([k, t]) => [k, `${k} · ${t.groups || t.name}`])
    : type === 'run' ? [['A', 'A · Resistência'], ['B', 'B · Velocidade']] : [];

  function draw() {
    el.innerHTML = `
      <section class="card">
        <h2>Divisão semanal</h2>
        <p class="small muted">Alterações valem a partir desta semana. O planejamento das semanas anteriores fica preservado no histórico.</p>
        ${days.map((d, i) => `<div class="plan-day" style="--c:var(--${d.type})">
          <b>${DAY_NAMES[i]}</b>
          <select data-type="${i}">
            <option value="strength" ${d.type === 'strength' ? 'selected' : ''}>Musculação</option>
            <option value="run" ${d.type === 'run' ? 'selected' : ''}>Corrida</option>
            <option value="rest" ${d.type === 'rest' ? 'selected' : ''}>Recuperação</option>
          </select>
          ${d.type !== 'rest' ? `<select data-ref="${i}">${refOptions(d.type).map(([k, l]) => `<option value="${k}" ${d.ref === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : '<span></span>'}
          ${d.type !== 'run' ? `<select class="extra-run" data-run="${i}" aria-label="Corrida no mesmo dia"><option value="">Sem corrida extra</option>${refOptions('run').map(([k, l]) => `<option value="${k}" ${d.run === k ? 'selected' : ''}>+ Corrida ${esc(l)}</option>`).join('')}</select>` : ''}
          <div class="updown"><button class="icon-btn" data-up="${i}" aria-label="Subir">↑</button><button class="icon-btn" data-down="${i}" aria-label="Descer">↓</button></div>
        </div>`).join('')}
        <div class="small muted top">${days.filter(d => d.type === 'strength').length} dias de musculação · ${days.filter(d => d.type === 'run' || d.run).length} de corrida · ${days.filter(d => d.type === 'rest').length} de recuperação</div>
        <button class="btn block top" id="save-plan">Salvar semana</button>
      </section>

      <section class="card">
        <h2>Planejamento inteligente</h2>
        <ul class="plain">${sug.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
        ${goalRepNote() ? `<p class="small"><b>Musculação:</b> ${esc(goalRepNote())} As sugestões de carga aparecem em cada exercício durante o treino.</p>` : ''}
        <button class="btn secondary block" id="apply-sug">Usar sugestão nas metas de corrida</button>
        <p class="small muted">Nada muda sem a sua confirmação.</p>
      </section>

      ${Object.entries(tpl.strength).map(([k, t]) => `<section class="card tpl" data-k="${k}" style="--c:var(--strength)">
        <div class="row"><h2 class="grow">Musculação ${k}</h2>${Object.keys(tpl.strength).length > 1 ? `<button class="link muted" data-rm-tpl="${k}">Excluir</button>` : ''}</div>
        <div class="grid2">${field('Nome', `<input data-t="name" value="${esc(t.name)}">`)}${field('Grupos musculares', `<input data-t="groups" value="${esc(t.groups)}">`)}</div>
        <div class="ex-edit head"><span>Exercício</span><span>Séries</span><span>Mín</span><span>Máx</span><span></span></div>
        ${t.exercises.map((e, ei) => `<div class="ex-edit" data-ei="${ei}">
          <input data-x="name" value="${esc(e.name)}" aria-label="Exercício">
          <input data-x="sets" type="number" inputmode="numeric" value="${e.sets}" aria-label="Séries">
          <input data-x="repMin" type="number" inputmode="numeric" value="${e.repMin}" aria-label="Repetições mínimas">
          <input data-x="repMax" type="number" inputmode="numeric" value="${e.repMax}" aria-label="Repetições máximas">
          <div class="updown"><button class="icon-btn" data-xu="${ei}" aria-label="Subir">↑</button><button class="icon-btn" data-xr="${ei}" aria-label="Remover">✕</button></div>
        </div>`).join('')}
        <button class="link" data-add-ex="${k}">+ exercício</button>
      </section>`).join('')}
      <button class="btn secondary block" id="add-tpl">+ Novo treino de musculação</button>

      <section class="card" style="--c:var(--run)">
        <h2>Corrida A – Resistência</h2>
        <div class="grid2">
          ${field('Meta de tempo (min)', `<input type="number" inputmode="numeric" data-r="A.targetMin" value="${tpl.run.A.targetMin}">`)}
          ${field('Meta de distância (km)', `<input type="number" inputmode="decimal" step="0.1" data-r="A.targetKm" value="${tpl.run.A.targetKm}">`)}
        </div>
        <h2>Corrida B – Velocidade</h2>
        <div class="grid2">
          ${field('Aquecimento (min)', `<input type="number" inputmode="numeric" data-r="B.warmupMin" value="${tpl.run.B.warmupMin}">`)}
          ${field('Quantidade de tiros', `<input type="number" inputmode="numeric" data-r="B.intervals" value="${tpl.run.B.intervals}">`)}
          ${field('Tempo do tiro (s)', `<input type="number" inputmode="numeric" data-r="B.workSec" value="${tpl.run.B.workSec}">`)}
          ${field('Recuperação (s)', `<input type="number" inputmode="numeric" data-r="B.recSec" value="${tpl.run.B.recSec}">`)}
          ${field('Desaquecimento (min)', `<input type="number" inputmode="numeric" data-r="B.cooldownMin" value="${tpl.run.B.cooldownMin}">`)}
          ${field('Ritmo-alvo do tiro (min:ss/km)', `<input data-rp="B.targetPaceSec" value="${tpl.run.B.targetPaceSec ? fmtPace(tpl.run.B.targetPaceSec) : ''}" placeholder="opcional">`)}
        </div>
      </section>
      <button class="btn block" id="save-tpl">Salvar treinos e metas</button>`;
    bind();
  }

  function readTemplates() {
    $$('.tpl', el).forEach(sec => {
      const t = tpl.strength[sec.dataset.k];
      t.name = $('[data-t="name"]', sec).value.trim() || t.name;
      t.groups = $('[data-t="groups"]', sec).value.trim();
      $$('.ex-edit[data-ei]', sec).forEach(row => {
        const e = t.exercises[+row.dataset.ei];
        e.name = $('[data-x="name"]', row).value.trim() || e.name;
        for (const f of ['sets', 'repMin', 'repMax']) e[f] = Math.max(1, num($(`[data-x="${f}"]`, row).value) || e[f]);
      });
    });
    $$('[data-r]', el).forEach(i => { const [r, f] = i.dataset.r.split('.'); const v = num(i.value); if (v != null) tpl.run[r][f] = v; });
    $$('[data-rp]', el).forEach(i => { const [r, f] = i.dataset.rp.split('.'); tpl.run[r][f] = i.value ? parseDur(i.value) : null; });
  }

  function bind() {
    $$('[data-type]', el).forEach(s => s.onchange = () => {
      const i = +s.dataset.type, type = s.value;
      days[i] = type === 'rest' ? { type, ...(days[i].run ? { run: days[i].run } : {}) } : { type, ref: refOptions(type)[0][0], ...(type !== 'run' && days[i].run ? { run: days[i].run } : {}) };
      readTemplates(); draw();
    });
    $$('[data-ref]', el).forEach(s => s.onchange = () => { days[+s.dataset.ref].ref = s.value; });
    $$('[data-run]', el).forEach(s => s.onchange = () => { const d = days[+s.dataset.run]; if (s.value) d.run = s.value; else delete d.run; readTemplates(); draw(); });
    const swap = (i, j) => { if (j < 0 || j > 6) return; [days[i], days[j]] = [days[j], days[i]]; readTemplates(); draw(); };
    $$('[data-up]', el).forEach(b => b.onclick = () => swap(+b.dataset.up, +b.dataset.up - 1));
    $$('[data-down]', el).forEach(b => b.onclick = () => swap(+b.dataset.down, +b.dataset.down + 1));
    $('#save-plan', el).onclick = async () => { await savePlan(days); toast('Semana atualizada'); };

    $$('[data-add-ex]', el).forEach(b => b.onclick = async () => {
      readTemplates();
      const name = await pickExercise();
      if (!name) return;
      tpl.strength[b.dataset.addEx].exercises.push({ id: uid(), name, sets: 3, repMin: 8, repMax: 12 });
      draw();
    });
    $$('.tpl', el).forEach(sec => {
      const t = tpl.strength[sec.dataset.k];
      $$('[data-xr]', sec).forEach(b => b.onclick = () => { readTemplates(); t.exercises.splice(+b.dataset.xr, 1); draw(); });
      $$('[data-xu]', sec).forEach(b => b.onclick = () => {
        const i = +b.dataset.xu; if (!i) return;
        readTemplates(); [t.exercises[i - 1], t.exercises[i]] = [t.exercises[i], t.exercises[i - 1]]; draw();
      });
    });
    $$('[data-rm-tpl]', el).forEach(b => b.onclick = () => {
      const k = b.dataset.rmTpl;
      if (days.some(d => d.type === 'strength' && d.ref === k)) { toast(`Musculação ${k} está na semana — troque o dia antes de excluir`); return; }
      if (!confirm(`Excluir o treino Musculação ${k}? O histórico já registrado é mantido.`)) return;
      readTemplates(); delete tpl.strength[k]; draw();
    });
    $('#add-tpl', el).onclick = () => {
      readTemplates();
      const k = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(l => !tpl.strength[l]);
      tpl.strength[k] = { name: `Musculação ${k}`, groups: '', exercises: [] };
      draw();
    };
    $('#apply-sug', el).onclick = async () => {
      if (!confirm('Atualizar as metas de corrida com a sugestão atual?')) return;
      readTemplates();
      Object.assign(tpl.run.A, sug.apply.A);
      Object.assign(tpl.run.B, sug.apply.B);
      await setKV('templates', structuredClone(tpl));
      toast('Metas de corrida atualizadas'); draw();
    };
    $('#save-tpl', el).onclick = async () => {
      readTemplates();
      await setKV('templates', structuredClone(tpl));
      toast('Treinos salvos');
    };
  }

  draw();
}
