// Roteador e inicialização do app.
import { load, S } from './store.js';
import * as home from './views/home.js';
import * as calendar from './views/calendar.js';
import * as strength from './views/strength.js';
import * as runs from './views/runs.js';
import * as tracker from './views/tracker.js';
import * as progress from './views/progress.js';
import * as body from './views/body.js';
import * as recovery from './views/recovery.js';
import * as plan from './views/plan.js';
import * as profile from './views/profile.js';
import * as library from './views/library.js';
import * as cardio from './views/cardio.js';
import * as goals from './views/goals.js';
import * as report from './views/report.js';
import { resumeRest } from './resttimer.js';
import { initUpdates } from './updater.js';
import { initCloud } from './cloud.js';
import { fmtDur } from './util.js';
import { icon } from './ui.js';

const ROUTES = {
  inicio: { title: 'Semana', tab: 'inicio', render: home.render },
  calendario: { title: 'Calendário', tab: 'mais', render: calendar.render },
  treino: { title: 'Musculação', tab: 'inicio', render: strength.render },
  descanso: { title: 'Recuperação', tab: 'inicio', render: strength.renderRest },
  corridas: { title: 'Minhas corridas', tab: 'corridas', render: runs.renderList },
  corrida: { title: 'Corrida', tab: 'corridas', render: runs.renderDetail },
  'corrida-manual': { title: 'Registrar corrida', tab: 'corridas', render: runs.renderManual },
  correr: { title: 'Correr', tab: 'corridas', render: tracker.render },
  evolucao: { title: 'Evolução', tab: 'evolucao', render: progress.render },
  corpo: { title: 'Corpo e fotos', tab: 'corpo', render: body.render },
  recuperacao: { title: 'Recuperação', tab: 'mais', render: recovery.render },
  plano: { title: 'Plano semanal', tab: 'mais', render: plan.render },
  perfil: { title: 'Perfil', tab: 'mais', render: profile.render },
  mais: { title: 'Mais', tab: 'mais', render: profile.renderMore },
  biblioteca: { title: 'Biblioteca de exercícios', tab: 'mais', render: library.render },
  cardio: { title: 'Cardio', tab: 'inicio', render: cardio.render },
  metas: { title: 'Metas e conquistas', tab: 'mais', render: goals.render },
  relatorio: { title: 'Minha evolução', tab: 'evolucao', render: report.render },
};

const TABS = [['inicio', 'home', 'Início'], ['corpo', 'camera', 'Fotos'], ['corridas', 'run', 'Corridas'], ['evolucao', 'chart', 'Evolução'], ['mais', 'more', 'Mais']];

function parseHash() {
  const [path, q] = (location.hash.slice(2) || 'inicio').split('?');
  const [name, arg] = path.split('/');
  return { name, params: { arg, ...Object.fromEntries(new URLSearchParams(q || '')) } };
}

function router() {
  let { name, params } = parseHash();
  if (!S.profile.name && name !== 'perfil') { location.replace('#/perfil'); return; }
  const r = ROUTES[name] || ROUTES.inicio;
  document.getElementById('title').textContent = r.title;
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === r.tab));
  updateLive(name);
  const view = document.getElementById('view');
  view.innerHTML = '';
  window.scrollTo(0, 0);
  try { r.render(view, params); }
  catch (e) { console.error(e); view.innerHTML = `<div class="card">Ocorreu um erro ao abrir esta tela.<br><small class="muted">${e.message}</small></div>`; }
}

// Faixa de "em andamento" para corrida ou musculação quando o usuário está em outra tela
function updateLive(name) {
  const live = document.getElementById('live');
  const w = strength.liveWorkout();
  if (tracker.isLive() && name !== 'correr') {
    live.hidden = false; live.href = '#/correr';
    live.textContent = 'Corrida ' + tracker.liveSummary().toLowerCase() + ' ›';
  } else if (w && name !== 'treino') {
    live.hidden = false; live.href = w.href;
    live.textContent = `${w.name} em andamento · ${fmtDur(strength.workoutElapsed(w) / 1000)}${w.pauseStart ? ' (pausado)' : ''} ›`;
  } else live.hidden = true;
}

// Tela de boas-vindas: fica aberta até o usuário tocar em "Entrar"
function closeSplash() {
  const el = document.getElementById('splash');
  if (!el || el.dataset.closing) return;
  el.dataset.closing = '1';
  el.classList.add('hide');
  setTimeout(() => el.remove(), 1300);
}
document.getElementById('sp-enter')?.addEventListener('click', closeSplash);

async function init() {
  document.querySelector('.tabbar').innerHTML = TABS.map(([t, ic, l]) => `<a href="#/${t}" data-tab="${t}">${icon(ic)}<span>${l}</span></a>`).join('');
  await load();
  window.addEventListener('hashchange', router);
  router();
  resumeRest();
  setInterval(() => updateLive(parseHash().name), 1000);
  initUpdates();
  initCloud(onCloudData);
}

// Chegaram dados da nuvem: atualiza a tela atual, exceto formulários em que o usuário pode estar digitando
const REFRESHABLE = ['inicio', 'calendario', 'corridas', 'evolucao', 'metas', 'relatorio', 'mais', 'biblioteca'];
function onCloudData() {
  const { name } = parseHash();
  if (name === 'perfil' && S.profile.name && !document.getElementById('p-name')?.value) { location.hash = '#/inicio'; return; }
  if (REFRESHABLE.includes(name || 'inicio')) router();
}

init();
