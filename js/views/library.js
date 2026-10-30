// Biblioteca de exercícios: busca, filtros, detalhes, recordes, observações e exercícios personalizados.
import { S, setKV } from '../store.js';
import { fmtDate, fmtNum, fmtInt, esc, toast } from '../util.js';
import { allExercises, findExercise, GROUPS, EQUIPMENT, LEVEL_NAME, newCustomId, videoUrl } from '../exercises.js';
import { personalRecords, exerciseHistory } from '../analysis.js';
import { lineChart } from '../charts.js';
import { $, $$, chips, bindChips, chipVal, field, sheet } from '../ui.js';

let q = '', group = '', equip = '';

const matches = e => {
  const t = q.trim().toLowerCase();
  return (!group || e.group === group) && (!equip || e.equipment === equip) &&
    (!t || [e.name, e.group, e.equipment, e.secondary].some(v => (v || '').toLowerCase().includes(t)));
};

function listHTML(pick) {
  const list = allExercises().filter(matches);
  if (!list.length) return '<p class="muted">Nenhum exercício encontrado.</p>';
  return list.map(e => `<button class="lib-item" data-ex="${esc(e.name)}">
    <span class="lib-ico">${esc(e.group.slice(0, 2))}</span>
    <span class="grow"><b>${esc(e.name)}</b><small>${esc(e.group)} · ${esc(e.equipment)}${e.builtin ? '' : ' · personalizado'}</small></span>
    <span class="muted">${pick ? '+' : '›'}</span></button>`).join('');
}

function filtersHTML() {
  return `<input type="search" id="lib-q" placeholder="Buscar por nome, músculo ou equipamento" value="${esc(q)}">
    <div class="scroll-chips top">${chips('group', [['', 'Todos'], ...GROUPS.map(g => [g, g])], group)}</div>
    <div class="scroll-chips">${chips('equip', [['', 'Todo equipamento'], ...EQUIPMENT.map(g => [g, g])], equip)}</div>`;
}

function bindFilters(root, refresh) {
  $('#lib-q', root).oninput = e => { q = e.target.value; refresh(); };
  bindChips(root, (n, v) => { if (n === 'group') group = v; if (n === 'equip') equip = v; refresh(); });
}

export function render(el) {
  el.innerHTML = `
    <section class="card">
      ${filtersHTML()}
      <div class="row top"><span class="small muted grow" id="lib-count"></span><button class="btn sm" id="lib-new">+ Exercício personalizado</button></div>
      <div id="lib-list" class="top"></div>
    </section>`;
  const refresh = () => {
    $('#lib-list', el).innerHTML = listHTML(false);
    $('#lib-count', el).textContent = `${allExercises().filter(matches).length} exercícios`;
    $$('[data-ex]', el).forEach(b => b.onclick = () => openDetail(b.dataset.ex, () => refresh()));
  };
  bindFilters(el, refresh);
  $('#lib-new', el).onclick = () => editCustom(null, refresh);
  refresh();
}

export function openDetail(name, onChange) {
  const e = findExercise(name) || { name, group: '—', equipment: '—', secondary: '', how: '', posture: '', errors: '', level: 1, builtin: false, adhoc: true };
  const pr = personalRecords(name);
  const hist = exerciseHistory(name);
  const u = pr?.unit === 's' ? 's' : '';
  const w = sheet(`
    <div class="row"><h2 class="grow">${esc(e.name)}</h2><button class="icon-btn" data-close aria-label="Fechar">✕</button></div>
    <div class="row wrap gap small"><span class="badge today">${esc(e.group)}</span><span class="badge">${esc(e.equipment)}</span><span class="badge">${LEVEL_NAME[e.level] || ''}</span></div>
    ${e.secondary ? `<p class="small muted top">Músculos secundários: ${esc(e.secondary)}</p>` : ''}
    ${e.how ? `<h3>Execução</h3><p class="small">${esc(e.how)}</p>` : ''}
    ${e.posture ? `<h3>Postura</h3><p class="small">${esc(e.posture)}</p>` : ''}
    ${e.errors ? `<h3>Erros comuns</h3><p class="small">${esc(e.errors)}</p>` : ''}
    <a class="link small" href="${videoUrl(e.name)}" target="_blank" rel="noopener">▶ Ver vídeos demonstrativos</a>
    ${pr ? `<h3>Recordes pessoais</h3><div class="grid2">
      <div class="stat"><span>Maior carga</span><b>${fmtNum(pr.maxLoad.value, 1)} kg</b><small>${pr.maxLoad.reps} reps · ${fmtDate(pr.maxLoad.date)}</small></div>
      <div class="stat"><span>Mais repetições</span><b>${pr.maxReps.value}${u}</b><small>${fmtDate(pr.maxReps.date)}</small></div>
      <div class="stat"><span>Maior volume</span><b>${fmtInt(pr.maxVolume.value)} kg</b><small>${fmtDate(pr.maxVolume.date)}</small></div>
      <div class="stat"><span>1RM estimado</span><b>${fmtNum(pr.bestE1rm.value, 1)} kg</b><small>${pr.sessions} sessões</small></div></div>
      <h3>Evolução da carga</h3>${lineChart([{ name: 'Carga', color: 'var(--primary)', values: hist.map(h => h.topLoad) }], { labels: hist.map(h => fmtDate(h.date)), yFmt: v => fmtNum(v, 0) })}` : '<p class="small muted top">Ainda sem registros deste exercício.</p>'}
    <label class="field"><span>Minhas observações</span><textarea id="ex-note" rows="2">${esc(S.exerciseNotes[e.name] || '')}</textarea></label>
    <div class="row gap">${!e.builtin && !e.adhoc ? '<button class="btn secondary" id="ex-edit">Editar</button>' : ''}<button class="btn grow" id="ex-save">Salvar observação</button></div>`);
  $('#ex-save', w).onclick = async () => {
    await setKV('exerciseNotes', { ...S.exerciseNotes, [e.name]: $('#ex-note', w).value });
    toast('Observação salva'); w.remove();
  };
  $('#ex-edit', w)?.addEventListener('click', () => { w.remove(); editCustom(e, onChange); });
}

function editCustom(ex, onDone) {
  const e = ex || { name: '', group: GROUPS[0], equipment: EQUIPMENT[0], secondary: '', how: '', posture: '', errors: '', level: 1 };
  const w = sheet(`
    <div class="row"><h2 class="grow">${ex ? 'Editar exercício' : 'Novo exercício'}</h2><button class="icon-btn" data-close aria-label="Fechar">✕</button></div>
    ${field('Nome', `<input id="c-name" value="${esc(e.name)}">`)}
    <div class="grid2">
      ${field('Grupo muscular', `<select id="c-group">${GROUPS.map(g => `<option ${g === e.group ? 'selected' : ''}>${g}</option>`).join('')}</select>`)}
      ${field('Equipamento', `<select id="c-equip">${EQUIPMENT.map(g => `<option ${g === e.equipment ? 'selected' : ''}>${g}</option>`).join('')}</select>`)}
    </div>
    <div class="field"><span>Nível</span>${chips('lvl', Object.entries(LEVEL_NAME), e.level)}</div>
    ${field('Músculos secundários', `<input id="c-sec" value="${esc(e.secondary)}">`)}
    ${field('Execução', `<textarea id="c-how" rows="2">${esc(e.how)}</textarea>`)}
    ${field('Postura', `<textarea id="c-pos" rows="2">${esc(e.posture)}</textarea>`)}
    ${field('Erros comuns', `<textarea id="c-err" rows="2">${esc(e.errors)}</textarea>`)}
    <div class="row gap">${ex ? '<button class="btn danger" id="c-del">Excluir</button>' : ''}<button class="btn grow" id="c-save">Salvar</button></div>`);
  bindChips(w);
  $('#c-save', w).onclick = async () => {
    const name = $('#c-name', w).value.trim();
    if (!name) { toast('Informe o nome'); return; }
    if (!ex && findExercise(name)) { toast('Já existe um exercício com esse nome'); return; }
    const obj = { id: ex?.id || newCustomId(name), name, group: $('#c-group', w).value, equipment: $('#c-equip', w).value, level: +chipVal(w, 'lvl') || 1,
      secondary: $('#c-sec', w).value, how: $('#c-how', w).value, posture: $('#c-pos', w).value, errors: $('#c-err', w).value };
    await setKV('customExercises', [...S.customExercises.filter(c => c.id !== obj.id), obj]);
    toast('Exercício salvo'); w.remove(); onDone?.(name);
  };
  $('#c-del', w)?.addEventListener('click', async () => {
    if (!confirm('Excluir este exercício personalizado? O histórico já registrado é mantido.')) return;
    await setKV('customExercises', S.customExercises.filter(c => c.id !== ex.id));
    w.remove(); onDone?.();
  });
}

/** Alternativas para substituir um exercício: mesmo grupo muscular, as mais fáceis primeiro. */
export function alternativesFor(name) {
  const cur = findExercise(name);
  if (!cur) return [];
  return allExercises()
    .filter(e => e.group === cur.group && e.name !== cur.name)
    .sort((a, b) => (a.level - b.level) || ((a.equipment === cur.equipment) - (b.equipment === cur.equipment)) || a.name.localeCompare(b.name, 'pt-BR'));
}

/**
 * Abre a biblioteca para escolher um exercício. Resolve com o nome escolhido ou null.
 * opts.replace = nome do exercício a substituir (abre no mesmo grupo, com sugestões no topo).
 */
export function pickExercise(opts = {}) {
  return new Promise(resolve => {
    // o seletor começa sem filtros e devolve os filtros da biblioteca ao fechar
    const saved = [q, group, equip];
    const cur = opts.replace ? findExercise(opts.replace) : null;
    q = ''; group = cur?.group || ''; equip = '';
    const alts = opts.replace ? alternativesFor(opts.replace).slice(0, 4) : [];
    const w = sheet(`<div class="row"><h2 class="grow">${opts.replace ? 'Substituir exercício' : 'Escolher exercício'}</h2><button class="icon-btn" data-close aria-label="Fechar">✕</button></div>
      ${opts.replace ? `<p class="small muted">Trocando <b>${esc(opts.replace)}</b>. Escolha uma alternativa que trabalhe o mesmo músculo.</p>
        ${alts.length ? `<h3>Sugestões${cur ? ` · ${esc(cur.group)}` : ''}</h3><div class="alt-list">${alts.map(e => `<button class="lib-item alt" data-ex="${esc(e.name)}">
          <span class="lib-ico">↺</span><span class="grow"><b>${esc(e.name)}</b><small>${esc(e.equipment)} · ${LEVEL_NAME[e.level]}</small></span><span class="muted">+</span></button>`).join('')}</div>
          <h3>Todos os exercícios</h3>` : ''}` : ''}
      ${filtersHTML()}<button class="link small" id="pk-new">+ Criar exercício personalizado</button><div id="pk-list" class="pick-list"></div>`);
    w.querySelector('.sheet').classList.add('tall');
    let done = false;
    const finish = v => { if (done) return; done = true; [q, group, equip] = saved; w.remove(); resolve(v); };
    $$('.alt-list [data-ex]', w).forEach(b => b.onclick = () => finish(b.dataset.ex));
    const refresh = () => {
      $('#pk-list', w).innerHTML = listHTML(true);
      $$('#pk-list [data-ex]', w).forEach(b => b.onclick = () => finish(b.dataset.ex));
    };
    bindFilters(w, refresh);
    $('#pk-new', w).onclick = () => editCustom(null, name => { if (name) finish(name); });
    new MutationObserver(() => { if (!w.isConnected) finish(null); }).observe(document.body, { childList: true });
    refresh();
  });
}
