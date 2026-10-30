// Cronômetro de descanso entre séries: barra fixa na tela, som, vibração e notificação ao terminar.
// Baseado no horário de término, então continua correto ao trocar de tela ou minimizar o app.
import { S } from './store.js';
import { fmtDur } from './util.js';

const KEY = 'rest-timer';
let st = null, timer = null, bar = null;

export const restSeconds = () => +S.profile.restSec || 90;

function ensureBar() {
  if (bar?.isConnected) return bar;
  bar = document.createElement('div');
  bar.className = 'rest-bar';
  bar.innerHTML = `<i class="rest-fill"></i><span class="rest-label">Descanso</span><b class="rest-time">00:00</b>
    <button class="btn sm secondary" data-r="-15">−15s</button><button class="btn sm secondary" data-r="15">+15s</button><button class="btn sm" data-r="skip">Pular</button>`;
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    if (b.dataset.r === 'skip') stopRest();
    else { st.endAt += +b.dataset.r * 1000; st.total = Math.max(5, st.total + +b.dataset.r); save(); tick(); }
  });
  document.body.appendChild(bar);
  return bar;
}

const save = () => localStorage.setItem(KEY, JSON.stringify(st));

export function startRest(sec = restSeconds(), label = 'Descanso') {
  st = { endAt: Date.now() + sec * 1000, total: sec, label };
  save();
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  ensureBar().classList.remove('done');
  bar.querySelector('.rest-label').textContent = label;
  clearInterval(timer);
  timer = setInterval(tick, 250);
  tick();
}

export function stopRest() {
  clearInterval(timer); timer = null; st = null;
  localStorage.removeItem(KEY);
  bar?.remove(); bar = null;
}

function tick() {
  if (!st) return;
  const left = (st.endAt - Date.now()) / 1000;
  if (left <= 0) return finish();
  ensureBar();
  bar.querySelector('.rest-time').textContent = fmtDur(Math.ceil(left));
  bar.querySelector('.rest-fill').style.width = `${Math.max(0, Math.min(100, (1 - left / st.total) * 100))}%`;
}

function finish() {
  clearInterval(timer); timer = null;
  localStorage.removeItem(KEY);
  st = null;
  beep();
  navigator.vibrate?.([300, 120, 300, 120, 300]);
  if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
    const opts = { body: 'Hora da próxima série.', icon: 'icons/icon-192.png', tag: 'rest' };
    navigator.serviceWorker?.getRegistration().then(r => r ? r.showNotification('Descanso concluído', opts) : new Notification('Descanso concluído', opts)).catch(() => {});
  }
  if (!bar) return;
  bar.classList.add('done');
  bar.querySelector('.rest-time').textContent = 'Pronto!';
  bar.querySelector('.rest-label').textContent = 'Descanso concluído';
  bar.querySelector('.rest-fill').style.width = '100%';
  setTimeout(() => { if (!st) { bar?.remove(); bar = null; } }, 4000);
}

let ctx;
function beep() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
  } catch { /* som indisponível */ }
}

// Retoma um descanso em andamento após recarregar a página
export function resumeRest() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!saved || saved.endAt <= Date.now()) { localStorage.removeItem(KEY); return; }
    st = saved; ensureBar(); bar.querySelector('.rest-label').textContent = st.label;
    timer = setInterval(tick, 250); tick();
  } catch { /* nada a retomar */ }
}
