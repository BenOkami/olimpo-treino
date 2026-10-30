// Cardio (esteira, bicicleta, elíptico...): cronômetro próprio e registro. Aberto ao finalizar a musculação.
import { S, put, del } from '../store.js';
import { todayISO, fmtDate, fmtDur, fmtNum, fmtInt, parseDur, num, esc, toast, metKcal } from '../util.js';
import { latestWeight } from '../analysis.js';
import { $, chips, bindChips, chipVal, field } from '../ui.js';
import { autoSend } from '../strava.js';

export const CARDIO_TYPES = [
  ['esteira', 'Esteira'], ['bike', 'Bicicleta ergométrica'], ['bike_rua', 'Bicicleta ao ar livre'], ['eliptico', 'Elíptico'],
  ['escada', 'Escada'], ['caminhada', 'Caminhada'], ['corrida', 'Corrida'], ['outro', 'Outros'],
];
export const cardioName = t => CARDIO_TYPES.find(c => c[0] === t)?.[1] || 'Cardio';

const KEY = 'cardio-live';
const HAS_INCLINE = ['esteira', 'caminhada'];
const HAS_RESIST = ['bike', 'eliptico', 'escada'];

// MET aproximado por atividade (velocidade ajusta esteira/caminhada/bike ao ar livre)
function met(type, speed) {
  if (type === 'esteira' || type === 'caminhada') return !speed ? (type === 'esteira' ? 6 : 3.8) : speed < 5 ? 3.5 : speed < 6.5 ? 4.5 : speed < 8 ? 7 : speed < 10 ? 9.5 : 11;
  if (type === 'bike_rua') return !speed ? 7.5 : speed < 16 ? 4 : speed < 20 ? 6.8 : speed < 25 ? 8 : 10;
  return { bike: 6.8, eliptico: 5, escada: 8.8, outro: 5 }[type] || 5;
}

const loadLive = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const liveElapsed = L => (L.pauseStart || Date.now()) - L.startedAt - (L.pausedMs || 0);

export function render(el, p) {
  const existing = p.id ? S.sessions.find(s => s.id === p.id) : null;
  const after = p.apos ? S.sessions.find(s => s.id === p.apos) : null;
  const date = existing?.date || p.data || todayISO();
  const c = existing ? { ...existing } : { kind: 'cardio', date, cardioType: loadLive()?.type || 'esteira', afterSessionId: after?.id || null };
  let live = existing ? null : loadLive();
  let tick = null;

  function draw() {
    const t = c.cardioType;
    el.innerHTML = `
      ${after ? `<section class="card head-card" style="--c:var(--strength)">
        <div class="small muted">Musculação concluída · ${fmtDur(after.durationSec)} · ${fmtInt(after.volume)} kg de volume</div>
        ${after.prs?.length ? `<div class="pr-list">${after.prs.map(x => `<span class="badge done">🏆 ${esc(x)}</span>`).join('')}</div>` : ''}
        <h2 class="top">Você fez cardio hoje?</h2>
        <a class="btn secondary block" href="#/inicio">Não fiz cardio — finalizar</a>
      </section>` : ''}
      <section class="card head-card" style="--c:var(--cardio)">
        <h2>${existing ? 'Editar cardio' : 'Cardio'}</h2>
        <div class="field"><span>Atividade</span>${chips('type', CARDIO_TYPES, t)}</div>
        ${t === 'corrida' ? `<p class="small">Corridas têm uma área própria com GPS, parciais e evolução.</p>
          <div class="grid2"><a class="btn run" href="#/correr?tipo=A">Corrida A</a><a class="btn run alt" href="#/correr?tipo=B">Corrida B</a></div>` : `
        ${!existing ? `<div class="timer-card">
          <div class="small muted center">Cronômetro do cardio</div>
          <div class="clock small-clock" id="c-clock">${fmtDur(live ? liveElapsed(live) / 1000 : 0)}</div>
          <div class="row gap">${!live ? '<button class="btn block run" id="c-start">Iniciar</button>'
            : `${live.pauseStart ? '<button class="btn grow run" id="c-resume">Retomar</button>' : '<button class="btn grow strength" id="c-pause">Pausar</button>'}<button class="btn grow danger" id="c-stop">Parar</button>`}</div>
        </div>` : ''}
        <div class="grid2">
          ${field('Data', `<input type="date" id="c-date" value="${c.date}">`)}
          ${field('Tempo total (h:mm:ss)', `<input id="c-time" value="${c.durationSec ? fmtDur(c.durationSec) : ''}" placeholder="25:00">`)}
          ${field('Distância (km)', `<input type="number" inputmode="decimal" step="0.01" id="c-km" value="${c.distanceKm ?? ''}">`)}
          ${field('Velocidade média (km/h)', `<input type="number" inputmode="decimal" step="0.1" id="c-speed" value="${c.avgSpeed ? +c.avgSpeed.toFixed(1) : ''}" placeholder="auto">`)}
          ${HAS_INCLINE.includes(t) ? field('Inclinação (%)', `<input type="number" inputmode="decimal" step="0.5" id="c-incl" value="${c.incline ?? ''}">`) : ''}
          ${HAS_RESIST.includes(t) ? field('Nível de resistência', `<input type="number" inputmode="numeric" id="c-res" value="${c.resistance ?? ''}">`) : ''}
          ${field('FC média (opcional)', `<input type="number" inputmode="numeric" id="c-hr" value="${c.hrAvg ?? ''}">`)}
        </div>
        <div class="stat"><span>Calorias estimadas</span><b id="c-kcal">–</b><small>Estimativa baseada em atividade, tempo e peso corporal — não é uma medição.</small></div>
        ${field('Observações', `<textarea id="c-notes" rows="2">${esc(c.notes || '')}</textarea>`)}
        <div class="row gap">${existing ? '<button class="btn danger" id="c-del">Excluir</button>' : ''}<button class="btn grow" id="c-save">Salvar cardio</button></div>`}
      </section>
      ${!existing ? recentHTML() : ''}`;
    bind();
  }

  function recentHTML() {
    const list = S.sessions.filter(s => s.kind === 'cardio').slice(-8).reverse();
    if (!list.length) return '';
    return `<section class="card"><h2>Últimos cardios</h2>${list.map(s => `<a class="list-link" href="#/cardio?id=${s.id}">
      <span class="tag" style="--c:var(--cardio)">C</span><div class="grow"><b>${esc(cardioName(s.cardioType))} · ${fmtDur(s.durationSec)}</b>
      <div class="small muted">${fmtDate(s.date)}${s.distanceKm ? ` · ${fmtNum(s.distanceKm, 2)} km` : ''} · ~${fmtInt(s.kcal)} kcal</div></div><span class="muted">›</span></a>`).join('')}</section>`;
  }

  function read() {
    const sec = parseDur($('#c-time', el)?.value);
    const km = num($('#c-km', el)?.value);
    let speed = num($('#c-speed', el)?.value);
    if (!speed && km && sec) speed = km / (sec / 3600);
    return { sec, km, speed };
  }
  function updateKcal() {
    const k = $('#c-kcal', el);
    if (!k) return;
    const { sec, speed } = read();
    k.textContent = sec ? `~${fmtInt(metKcal(met(c.cardioType, speed), latestWeight(c.date) || 70, sec))} kcal` : '–';
  }

  function bind() {
    bindChips(el, (n, v) => {
      if (n !== 'type') return;
      Object.assign(c, collect());
      c.cardioType = v;
      if (live) { live.type = v; localStorage.setItem(KEY, JSON.stringify(live)); }
      draw();
    });
    ['#c-time', '#c-km', '#c-speed'].forEach(s => $(s, el)?.addEventListener('input', updateKcal));
    $('#c-start', el)?.addEventListener('click', () => {
      live = { startedAt: Date.now(), pausedMs: 0, pauseStart: null, type: c.cardioType };
      localStorage.setItem(KEY, JSON.stringify(live)); draw();
    });
    $('#c-pause', el)?.addEventListener('click', () => { live.pauseStart = Date.now(); localStorage.setItem(KEY, JSON.stringify(live)); draw(); });
    $('#c-resume', el)?.addEventListener('click', () => { live.pausedMs += Date.now() - live.pauseStart; live.pauseStart = null; localStorage.setItem(KEY, JSON.stringify(live)); draw(); });
    $('#c-stop', el)?.addEventListener('click', () => {
      Object.assign(c, collect());
      c.durationSec = Math.round(liveElapsed(live) / 1000);
      c.startEpoch = live.startedAt;
      live = null; localStorage.removeItem(KEY);
      draw(); toast('Tempo registrado — complete os dados e salve');
    });
    $('#c-save', el)?.addEventListener('click', async () => {
      Object.assign(c, collect());
      if (live) { c.durationSec = Math.round(liveElapsed(live) / 1000); c.startEpoch = live.startedAt; }
      if (!c.durationSec) { toast('Informe o tempo ou use o cronômetro'); return; }
      c.kcal = Math.round(metKcal(met(c.cardioType, c.avgSpeed), latestWeight(c.date) || 70, c.durationSec));
      await put('sessions', c);
      autoSend(c);
      localStorage.removeItem(KEY);
      toast('Cardio salvo'); location.hash = '#/inicio';
    });
    $('#c-del', el)?.addEventListener('click', async () => {
      if (!confirm('Excluir este cardio?')) return;
      await del('sessions', c.id); history.back();
    });
    updateKcal();
    clearInterval(tick);
    if (live && !live.pauseStart) tick = setInterval(() => {
      const k = el.querySelector('#c-clock');
      if (!k || !live) { clearInterval(tick); return; }
      k.textContent = fmtDur(liveElapsed(live) / 1000);
    }, 1000);
  }

  function collect() {
    if (!$('#c-date', el)) return {};
    const { sec, km, speed } = read();
    return {
      date: $('#c-date', el).value || c.date, durationSec: sec || c.durationSec || 0, distanceKm: km, avgSpeed: speed,
      incline: num($('#c-incl', el)?.value), resistance: num($('#c-res', el)?.value), hrAvg: num($('#c-hr', el)?.value),
      notes: $('#c-notes', el).value,
    };
  }

  draw();
}
