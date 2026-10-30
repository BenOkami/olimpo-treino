// Componentes de interface reutilizados pelas telas.
import { esc } from './util.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const TYPE_COLOR = { strength: 'var(--strength)', run: 'var(--run)', rest: 'var(--rest)', cardio: 'var(--cardio)' };
export const TYPE_NAME = { strength: 'Musculação', run: 'Corrida', rest: 'Recuperação', cardio: 'Cardio' };
export const STATUS_LABEL = { done: 'Concluído', today: 'Hoje', pending: 'Pendente', missed: 'Não realizado', moved: 'Remarcado', rest: 'Descanso' };

export const stat = (label, value, sub = '') =>
  `<div class="stat"><span>${esc(label)}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;

export const badge = (status, text) => `<span class="badge ${status}">${esc(text || STATUS_LABEL[status] || status)}</span>`;

/** Grupo de botões de escolha. multi = seleção múltipla. */
export function chips(name, options, value, multi = false) {
  const sel = multi ? new Set(value || []) : null;
  return `<div class="chips" data-chips="${name}" ${multi ? 'data-multi="1"' : ''}>${options.map(([v, l]) => {
    const on = multi ? sel.has(String(v)) : String(v) === String(value ?? '');
    return `<button type="button" class="chip ${on ? 'on' : ''}" data-v="${esc(v)}">${esc(l)}</button>`;
  }).join('')}</div>`;
}

export function bindChips(root, cb) {
  $$('[data-chips]', root).forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    if (g.dataset.multi) b.classList.toggle('on');
    else $$('.chip', g).forEach(c => c.classList.toggle('on', c === b));
    cb?.(g.dataset.chips, chipVal(root, g.dataset.chips));
  }));
}

export function chipVal(root, name) {
  const g = $(`[data-chips="${name}"]`, root);
  if (!g) return null;
  if (g.dataset.multi) return $$('.chip.on', g).map(c => c.dataset.v);
  return $('.chip.on', g)?.dataset.v ?? null;
}

export const scale = (n, from = 1) => [...Array(n)].map((_, i) => [i + from, String(i + from)]);

export function insightList(list) {
  if (!list.length) return '';
  const icon = { warn: '!', ok: '✓', info: 'i' };
  return list.map(i => `<div class="insight ${i.level}"><span class="ico">${icon[i.level]}</span><div><b>${esc(i.title)}</b><p>${esc(i.text)}</p></div></div>`).join('');
}

export const field = (label, input) => `<label class="field"><span>${esc(label)}</span>${input}</label>`;

export function sheet(html) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) wrap.remove(); });
  document.body.appendChild(wrap);
  return wrap;
}

export const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  run: '<circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5M6 12l3-4 4 1 3 4 3 1M11 15l-2-3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  dumbbell: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  body: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v7M7 9l5 1 5-1M9 21l3-7 3 7"/>',
  plan: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  book: '<path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 8h6M8 12h6"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 14v4M8 21h8"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M8 12h2l1-2 2 4 1-2h2"/>',
};
export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
