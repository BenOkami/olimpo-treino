// Registro de musculação (séries, cargas, repetições, cronômetros) e registro dos dias de recuperação.
import { S, put, del, setKV } from '../store.js';
import { todayISO, fmtDate, fmtDur, fmtNum, fmtInt, esc, num, toast, metKcal } from '../util.js';
import { pendingItemFor } from '../schedule.js';
import { strengthSuggestion, exerciseHistory, recoveryFlag, strengthVolume, goalRepNote, latestWeight, sessionPRs } from '../analysis.js';
import { $, $$, chips, bindChips, chipVal, scale, field, insightList } from '../ui.js';
import { REST_ACTIVITIES } from '../defaults.js';
import { startRest, stopRest, restSeconds } from '../resttimer.js';
import { pickExercise, openDetail } from './library.js';
import { autoSend } from '../strava.js';

const DRAFT = 'draft-strength-';
export const LIVE_KEY = 'strength-live';

// Tempo de treino considerando pausas
export const workoutElapsed = s => (s.pauseStart || Date.now()) - s.startedAt - (s.pausedMs || 0);

export function liveWorkout() {
  try { return JSON.parse(localStorage.getItem(LIVE_KEY)); } catch { return null; }
}

export function render(el, p) {
  const today = todayISO();
  let session, draftKey = null, href = location.hash;
  if (p.id) {
    const s = S.sessions.find(x => x.id === p.id);
    if (!s) { el.innerHTML = '<p class="card">Treino não encontrado.</p>'; return; }
    session = structuredClone(s);
  } else {
    const ref = p.ref || 'A';
    const date = p.date || today;
    const planDate = p.plan || pendingItemFor('strength', date)?.origin || null;
    draftKey = DRAFT + (planDate || date) + ref;
    session = JSON.parse(localStorage.getItem(draftKey) || 'null') || newSession(ref, date, planDate);
  }
  const tpl = S.templates.strength[session.ref] || { name: 'Musculação ' + session.ref, groups: '', exercises: [] };
  const flag = recoveryFlag(today);
  let clock = null;

  const saveDraft = () => {
    if (!draftKey) return;
    localStorage.setItem(draftKey, JSON.stringify(session));
    localStorage.setItem(LIVE_KEY, JSON.stringify({ href, name: tpl.name, startedAt: session.startedAt, pausedMs: session.pausedMs || 0, pauseStart: session.pauseStart || null }));
  };
  const clearDraft = () => { if (draftKey) localStorage.removeItem(draftKey); localStorage.removeItem(LIVE_KEY); };

  function draw() {
    const paused = !!session.pauseStart;
    el.innerHTML = `
      <section class="card head-card" style="--c:var(--strength)">
        <div class="small muted">${p.id ? 'Editando treino de ' + fmtDate(session.date) : 'Treino em andamento'}</div>
        <h2>${esc(tpl.name)}</h2><div class="small muted">${esc(tpl.groups)}</div>
        ${!p.id ? `<div class="workout-clock ${paused ? 'paused' : ''}"><b id="w-clock">${fmtDur(workoutElapsed(session) / 1000)}</b>
          <button class="btn sm ${paused ? 'run' : 'strength'}" id="w-pause">${paused ? 'Retomar' : 'Pausar'}</button></div>
          <div class="field"><span>Descanso entre séries</span>${chips('rest', [[45, '45s'], [60, '60s'], [90, '90s'], [120, '2min'], [180, '3min']], restSeconds())}</div>` : ''}
        ${goalRepNote() ? `<p class="small muted">${esc(goalRepNote())}</p>` : ''}
      </section>
      ${flag && !p.id ? insightList([{ level: 'warn', title: 'Atenção à recuperação', text: 'Há sinais de carga alta ou recuperação insuficiente nos seus registros. As sugestões de hoje mantêm as cargas atuais.' }]) : ''}
      ${session.exercises.map((e, ei) => exerciseCard(e, ei)).join('')}
      <button class="btn secondary block" id="add-ex">+ Adicionar exercício da biblioteca</button>
      <section class="card">
        <h2>Finalizar</h2>
        <div class="grid2">
          ${field('Data', `<input type="date" id="f-date" value="${session.date}">`)}
          ${field('Duração (min)', `<input type="number" inputmode="numeric" id="f-dur" value="${session.durationSec ? Math.round(session.durationSec / 60) : Math.max(1, Math.round(workoutElapsed(session) / 60000))}">`)}
        </div>
        <div class="field"><span>Percepção de esforço (1 = muito leve, 10 = máximo)</span>${chips('rpe', scale(10), session.rpe)}</div>
        ${field('Observações', `<textarea id="f-notes" rows="2">${esc(session.notes || '')}</textarea>`)}
        <div class="small muted">Volume do treino: <b id="vol">${fmtInt(strengthVolume(session))} kg</b> · Volume = peso × repetições de cada série</div>
        <div class="row gap top">
          ${p.id ? '<button class="btn danger" id="f-del">Excluir</button>' : '<button class="btn secondary" id="f-discard">Descartar</button>'}
          <button class="btn strength grow" id="f-save">Finalizar treino</button>
        </div>
      </section>`;
    bind();
  }

  function exerciseCard(e, ei) {
    const ex = { name: e.name, sets: e.target?.sets || e.sets.length, repMin: e.target?.repMin || 8, repMax: e.target?.repMax || 12, unit: e.unit };
    const hist = exerciseHistory(e.name).filter(h => h.sessionId !== session.id);
    const last = hist.at(-1);
    const sug = p.id ? null : strengthSuggestion(ex, flag);
    const u = e.unit === 's' ? 's' : 'reps';
    const note = S.exerciseNotes[e.name];
    return `<section class="card ex" data-e="${ei}">
      <div class="row"><button class="ex-name grow" data-info="${ei}"><b>${esc(e.name)}</b><span class="small muted">${ex.sets} × ${ex.repMin}–${ex.repMax} ${u} · ver execução</span></button>
        <button class="btn sm secondary swap" data-swap="${ei}" aria-label="Substituir exercício">↺ Substituir</button>
        <button class="icon-btn" data-rm-ex="${ei}" aria-label="Remover exercício">✕</button></div>
      ${e.replaced ? `<div class="small muted">Substituindo: ${esc(e.replaced)}</div>` : ''}
      ${last ? `<div class="small muted">Último treino (${fmtDate(last.date)}): ${last.sets.map(x => `${fmtNum(x.load || 0, 1).replace(',0', '')}×${x.reps}`).join(', ')}</div>` : ''}
      ${note ? `<div class="small muted">📝 ${esc(note)}</div>` : ''}
      ${sug ? `<div class="sugg small">${esc(sug.text)}${sug.load != null && sug.load !== +e.sets[0]?.load ? ` <button class="link" data-use="${ei}" data-load="${sug.load}">Usar ${fmtNum(sug.load, 1).replace(',0', '')} kg</button>` : ''}</div>` : ''}
      <div class="set-row head"><span>#</span><span>kg</span><span>${u}</span><span></span></div>
      ${e.sets.map((x, si) => `<div class="set-row ${x.done ? 'done' : ''}">
        <span class="muted">${si + 1}</span>
        <input type="number" inputmode="decimal" step="0.5" data-f="load" data-s="${si}" value="${x.load ?? ''}" placeholder="${last?.topLoad ?? ''}">
        <input type="number" inputmode="numeric" data-f="reps" data-s="${si}" value="${x.reps ?? ''}" placeholder="${last?.sets[si]?.reps ?? ex.repMax}">
        <button class="check ${x.done ? 'on' : ''}" data-done="${si}" aria-label="Concluir série">✓</button>
      </div>`).join('')}
      <div class="row gap"><button class="link" data-add-set="${ei}">+ série</button>${e.sets.length > 1 ? `<button class="link muted" data-rm-set="${ei}">− série</button>` : ''}</div>
    </section>`;
  }

  function bind() {
    $$('.ex', el).forEach(card => {
      const ei = +card.dataset.e, e = session.exercises[ei];
      $$('input[data-f]', card).forEach(inp => inp.oninput = () => {
        e.sets[+inp.dataset.s][inp.dataset.f] = num(inp.value);
        $('#vol', el).textContent = fmtInt(strengthVolume(session)) + ' kg';
        saveDraft();
      });
      $$('[data-done]', card).forEach(b => b.onclick = () => {
        const si = +b.dataset.done, x = e.sets[si];
        const row = b.closest('.set-row');
        if (!x.done) {
          // preenche com o valor sugerido (placeholder) quando o campo ficou vazio
          if (x.reps == null) x.reps = num($('[data-f="reps"]', row).placeholder);
          if (x.load == null) x.load = num($('[data-f="load"]', row).placeholder) ?? 0;
          x.doneAt = Date.now();
          if (!p.id) startRest(restSeconds(), si + 1 < e.sets.length ? `Descanso · ${e.name}` : 'Descanso · próximo exercício');
        }
        x.done = !x.done;
        saveDraft(); draw();
      });
    });
    $$('[data-info]', el).forEach(b => b.onclick = () => openDetail(session.exercises[+b.dataset.info].name));
    $$('[data-use]', el).forEach(b => b.onclick = () => {
      const e = session.exercises[+b.dataset.use];
      e.sets.forEach(x => { if (!x.done) x.load = +b.dataset.load; });
      saveDraft(); draw();
    });
    $$('[data-add-set]', el).forEach(b => b.onclick = () => {
      const e = session.exercises[+b.dataset.addSet];
      const prev = e.sets.at(-1);
      e.sets.push({ load: prev?.load ?? null, reps: null, done: false });
      saveDraft(); draw();
    });
    $$('[data-rm-set]', el).forEach(b => b.onclick = () => { session.exercises[+b.dataset.rmSet].sets.pop(); saveDraft(); draw(); });
    $$('[data-swap]', el).forEach(b => b.onclick = async () => {
      const e = session.exercises[+b.dataset.swap];
      if (e.sets.some(x => x.done) && !confirm('Este exercício já tem séries concluídas. Substituir mesmo assim? As séries feitas serão descartadas.')) return;
      const name = await pickExercise({ replace: e.name });
      if (!name || name === e.name) return;
      const old = e.replaced || e.name;
      const last = exerciseHistory(name).at(-1);
      Object.assign(e, { name, replaced: old, unit: undefined });
      e.sets = e.sets.map(() => ({ load: last?.topLoad ?? null, reps: null, done: false }));
      saveDraft(); draw();
      toast(`${old} substituído por ${name}`);
      // Opcional: levar a troca para o plano, para os próximos treinos
      const tplEx = S.templates.strength[session.ref]?.exercises.find(x => x.name === old);
      if (tplEx && confirm(`Usar "${name}" no lugar de "${old}" também nos próximos treinos de ${tpl.name}?`)) {
        const t = structuredClone(S.templates);
        t.strength[session.ref].exercises.find(x => x.name === old).name = name;
        await setKV('templates', t);
        toast('Plano atualizado');
      }
    });
    $$('[data-rm-ex]', el).forEach(b => b.onclick = () => {
      if (!confirm('Remover este exercício do treino de hoje?')) return;
      session.exercises.splice(+b.dataset.rmEx, 1); saveDraft(); draw();
    });
    $('#add-ex', el).onclick = async () => {
      const name = await pickExercise();
      if (!name) return;
      const last = exerciseHistory(name).at(-1);
      session.exercises.push({ name, target: { sets: 3, repMin: 8, repMax: 12 }, sets: [0, 1, 2].map(() => ({ load: last?.topLoad ?? null, reps: null, done: false })) });
      saveDraft(); draw();
      el.querySelector('.ex:last-of-type')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    $('#w-pause', el)?.addEventListener('click', () => {
      if (session.pauseStart) { session.pausedMs = (session.pausedMs || 0) + Date.now() - session.pauseStart; session.pauseStart = null; }
      else session.pauseStart = Date.now();
      saveDraft(); draw();
    });
    bindChips(el, async (n, v) => {
      if (n === 'rpe') { session.rpe = +v; saveDraft(); }
      if (n === 'rest') await setKV('profile', { ...S.profile, restSec: +v });
    });
    $('#f-notes', el).oninput = e => { session.notes = e.target.value; saveDraft(); };
    $('#f-date', el).onchange = e => { session.date = e.target.value; saveDraft(); };
    $('#f-save', el).onclick = async () => {
      if (!session.exercises.some(e => e.sets.some(x => x.done))) {
        if (!confirm('Nenhuma série foi marcada como concluída. Salvar mesmo assim?')) return;
      }
      if (session.pauseStart) { session.pausedMs = (session.pausedMs || 0) + Date.now() - session.pauseStart; session.pauseStart = null; }
      session.durationSec = (num($('#f-dur', el).value) || 0) * 60;
      session.rpe = +chipVal(el, 'rpe') || session.rpe || null;
      session.kcal = Math.round(metKcal(5, latestWeight(session.date) || 70, session.durationSec));
      session.volume = strengthVolume(session);
      session.endedAt = session.endedAt || Date.now();
      const prs = sessionPRs(session);
      session.prs = prs;
      await put('sessions', session);
      if (!p.id) autoSend(session);
      clearDraft(); stopRest();
      toast(prs.length ? `Novo recorde! ${prs[0]}` : 'Treino salvo');
      location.hash = p.id ? '#/inicio' : `#/cardio?apos=${session.id}&data=${session.date}`;
    };
    $('#f-discard', el)?.addEventListener('click', () => {
      if (!confirm('Descartar este treino sem salvar?')) return;
      clearDraft(); stopRest(); location.hash = '#/inicio';
    });
    $('#f-del', el)?.addEventListener('click', async () => {
      if (!confirm('Excluir este treino do histórico?')) return;
      await del('sessions', session.id); toast('Treino excluído'); history.back();
    });
  }

  draw();
  saveDraft();
  clearInterval(clock);
  clock = setInterval(() => {
    const c = el.querySelector('#w-clock');
    if (!c) { clearInterval(clock); return; }
    c.textContent = fmtDur(workoutElapsed(session) / 1000);
  }, 1000);
}

function newSession(ref, date, planDate) {
  const tpl = S.templates.strength[ref];
  const flag = recoveryFlag();
  return {
    kind: 'strength', ref, date, planDate, startedAt: Date.now(), pausedMs: 0, pauseStart: null, rpe: null, notes: '',
    exercises: (tpl?.exercises || []).map(ex => {
      const sug = strengthSuggestion(ex, flag);
      return {
        name: ex.name, unit: ex.unit, target: { sets: ex.sets, repMin: ex.repMin, repMax: ex.repMax },
        sets: Array.from({ length: ex.sets }, () => ({ load: sug.load, reps: null, done: false })),
      };
    }),
  };
}

/* ---------- dias de recuperação ---------- */

export function renderRest(el, p) {
  const today = todayISO();
  const existing = p.id ? S.sessions.find(s => s.id === p.id) : null;
  const date = existing?.date || p.date || today;
  const s = existing ? { ...existing } : { kind: 'rest', date, planDate: p.plan || pendingItemFor('rest', date)?.origin || null, activities: [], notes: '' };
  el.innerHTML = `
    <section class="card head-card" style="--c:var(--rest)">
      <div class="small muted">${fmtDate(date)}</div><h2>Dia de recuperação</h2>
      <p class="small muted">Registre o descanso. Caminhadas leves, mobilidade e alongamento são opcionais.</p>
    </section>
    <section class="card">
      <div class="field"><span>O que você fez?</span>${chips('act', REST_ACTIVITIES, s.activities, true)}</div>
      ${field('Duração da atividade (min, opcional)', `<input type="number" inputmode="numeric" id="r-dur" value="${s.durationSec ? Math.round(s.durationSec / 60) : ''}">`)}
      ${field('Observações', `<textarea id="r-notes" rows="2">${esc(s.notes || '')}</textarea>`)}
      <div class="row gap">${existing ? '<button class="btn danger" id="r-del">Excluir</button>' : ''}<button class="btn rest grow" id="r-save">Salvar</button></div>
    </section>
    <a class="btn secondary block" href="#/recuperacao?data=${date}">Registrar sono, disposição e dores</a>`;
  bindChips(el);
  $('#r-save', el).onclick = async () => {
    s.activities = chipVal(el, 'act');
    s.durationSec = (num($('#r-dur', el).value) || 0) * 60;
    s.notes = $('#r-notes', el).value;
    const met = s.activities.includes('caminhada') ? 3 : 2.3;
    s.kcal = s.durationSec ? Math.round(metKcal(met, latestWeight(date) || 70, s.durationSec)) : 0;
    await put('sessions', s);
    toast('Recuperação registrada'); location.hash = '#/inicio';
  };
  $('#r-del', el)?.addEventListener('click', async () => {
    if (!confirm('Excluir este registro?')) return;
    await del('sessions', s.id); history.back();
  });
}
