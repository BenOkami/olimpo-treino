// Metas personalizadas e conquistas (medalhas) calculadas a partir do histórico.
import { S, setKV } from '../store.js';
import { todayISO, addDays, weekStart, daysBetween, fmtDate, fmtNum, fmtInt, uid, num, sum, esc, toast } from '../util.js';
import { training, runs, strengthSessions, strengthVolume, exerciseNames, personalRecords, latestWeight, adherence } from '../analysis.js';
import { weekProgress } from '../schedule.js';
import { $, $$, field, sheet } from '../ui.js';
import { MEASURES } from '../defaults.js';

const GOAL_TYPES = {
  sessoes_semana: { label: 'Treinos por semana', unit: 'treinos', hint: 'Ex.: treinar 5 vezes por semana' },
  cardio_semana: { label: 'Minutos de cardio por semana', unit: 'min', hint: 'Corrida e cardio somados. Ex.: 150 min' },
  km_semana: { label: 'Km de corrida por semana', unit: 'km', hint: 'Ex.: 15 km' },
  carga: { label: 'Aumentar carga em um exercício', unit: 'kg', hint: 'Ex.: +5 kg no supino', param: 'exercise' },
  medida: { label: 'Reduzir uma medida', unit: 'cm', hint: 'Ex.: −3 cm de cintura', param: 'measure' },
  peso: { label: 'Chegar a um peso', unit: 'kg', hint: 'Peso desejado' },
  medidas_freq: { label: 'Registrar medidas a cada N dias', unit: 'dias', hint: 'Ex.: a cada 15 dias' },
  dias_mes: { label: 'Dias treinados em 30 dias', unit: 'dias', hint: 'Consistência. Ex.: 20 dias' },
};

const latestMeasure = k => [...S.body].reverse().find(b => b.measures?.[k])?.measures[k] ?? null;
const weekSum = (fn, kinds) => {
  const ws = weekStart(todayISO()), we = addDays(ws, 6);
  return sum(S.sessions.filter(s => kinds.includes(s.kind) && s.date >= ws && s.date <= we).map(fn));
};

export function goalProgress(g) {
  const today = todayISO();
  switch (g.type) {
    case 'sessoes_semana': { const v = new Set(training().filter(s => s.date >= weekStart(today) && s.date <= today).map(s => s.date + s.kind)).size; return { value: v, pct: v / g.target, text: `${v} de ${g.target} nesta semana` }; }
    case 'cardio_semana': { const v = Math.round(weekSum(s => s.durationSec / 60, ['run', 'cardio'])); return { value: v, pct: v / g.target, text: `${v} de ${g.target} min nesta semana` }; }
    case 'km_semana': { const v = weekSum(s => s.distanceKm || 0, ['run']); return { value: v, pct: v / g.target, text: `${fmtNum(v)} de ${fmtNum(g.target)} km nesta semana` }; }
    case 'carga': { const pr = personalRecords(g.param)?.maxLoad.value ?? g.base ?? 0; const v = pr - (g.base ?? 0); return { value: v, pct: v / g.target, text: `${v >= 0 ? '+' : ''}${fmtNum(v, 1)} de +${fmtNum(g.target, 1)} kg (recorde atual ${fmtNum(pr, 1)} kg)` }; }
    case 'medida': { const cur = latestMeasure(g.param); const v = g.base != null && cur != null ? g.base - cur : 0; return { value: v, pct: v / g.target, text: `${v >= 0 ? '−' : '+'}${fmtNum(Math.abs(v), 1)} de −${fmtNum(g.target, 1)} cm (atual ${cur != null ? fmtNum(cur, 1) : '–'} cm)` }; }
    case 'peso': {
      const cur = latestWeight(), base = g.base ?? cur;
      if (cur == null || base == null) return { value: 0, pct: 0, text: 'Registre seu peso em Corpo e fotos' };
      const pct = base === g.target ? 1 : (base - cur) / (base - g.target);
      return { value: cur, pct, text: `Atual ${fmtNum(cur, 1)} kg · meta ${fmtNum(g.target, 1)} kg (início ${fmtNum(base, 1)} kg)` };
    }
    case 'medidas_freq': {
      const last = [...S.body].reverse().find(b => b.measures && Object.keys(b.measures).length);
      if (!last) return { value: 0, pct: 0, text: 'Nenhuma medida registrada ainda' };
      const d = daysBetween(last.date, today), left = g.target - d;
      return { value: d, pct: left >= 0 ? 1 : 0, text: left >= 0 ? `Em dia · próximo registro em ${left} dia(s)` : `Atrasado ${-left} dia(s) · último em ${fmtDate(last.date)}` };
    }
    case 'dias_mes': { const v = new Set(training().filter(s => s.date > addDays(today, -30) && s.date <= today).map(s => s.date)).size; return { value: v, pct: v / g.target, text: `${v} de ${g.target} dias nos últimos 30 dias` }; }
    default: return { value: 0, pct: 0, text: '' };
  }
}

/* ---------- conquistas ---------- */

function bestWeeks() {
  // semanas completas (todas as atividades planejadas feitas), contando semanas já encerradas
  let perfect = 0;
  const first = training()[0]?.date;
  if (!first) return 0;
  for (let ws = weekStart(first); addDays(ws, 6) < todayISO(); ws = addDays(ws, 7)) {
    const { total, done } = weekProgress(ws);
    if (total && done === total) perfect++;
  }
  return perfect;
}

export function medals() {
  const tr = training(), rs = runs(), ss = strengthSessions();
  const km = sum(rs.map(r => r.distanceKm));
  const vol = sum(ss.map(strengthVolume));
  const cardioMin = sum(S.sessions.filter(s => s.kind === 'cardio' || s.kind === 'run').map(s => s.durationSec / 60));
  const prs = sum(ss.map(s => s.prs?.length || 0));
  const longest = Math.max(0, ...rs.map(r => r.distanceKm));
  const photos = S.body.filter(b => b.photos && Object.values(b.photos).some(Boolean)).length;
  const ad = adherence(28);
  const pw = bestWeeks();
  const m = (icon, title, desc, cur, goal) => ({ icon, title, desc, cur, goal, earned: cur >= goal });
  return [
    m('🏛️', 'Aspirante ao Olimpo', 'Registre seu primeiro treino', tr.length, 1),
    m('🛡️', 'Hoplita', 'Complete 10 sessões', tr.length, 10),
    m('⚔️', 'Espartano', 'Complete 50 sessões', tr.length, 50),
    m('⚡', 'Semideus', 'Complete 100 sessões', tr.length, 100),
    m('🌿', 'Coroa de louros', 'Conclua todas as atividades de uma semana', pw, 1),
    m('🏺', 'Olimpíada', 'Quatro semanas com tudo concluído', pw, 4),
    m('🦉', 'Sabedoria', 'Adesão de 80% ou mais em 4 semanas', ad.planned >= 12 && ad.rate >= 0.8 ? 1 : 0, 1),
    m('👟', 'Primeira corrida', 'Registre uma corrida', rs.length, 1),
    m('🪽', 'Mensageiro', 'Corra 5 km em uma única corrida', longest, 5),
    m('🏃', 'Maratonista', 'Corra 10 km em uma única corrida', longest, 10),
    m('⛵', 'Odisseia', 'Some 50 km de corrida', km, 50),
    m('🔱', 'Argonauta', 'Some 200 km de corrida', km, 200),
    m('⏳', 'Mil minutos', 'Corrida e cardio somados', cardioMin, 1000),
    m('🦁', 'Primeiro recorde', 'Supere sua maior carga em um exercício', prs, 1),
    m('🥇', '25 recordes', 'Bata 25 recordes pessoais', prs, 25),
    m('🌍', '10 toneladas', 'Volume total de musculação de 10.000 kg', vol, 10000),
    m('🗿', '100 toneladas', 'Volume total de 100.000 kg', vol, 100000),
    m('🪞', 'Primeira foto', 'Registre uma foto de evolução', photos, 1),
    m('📐', 'Medidas em dia', 'Faça 5 registros corporais', S.body.length, 5),
  ];
}

/* ---------- tela ---------- */

export function render(el) {
  const list = medals();
  const earned = list.filter(x => x.earned).length;
  el.innerHTML = `
    <section class="card">
      <div class="row"><h2 class="grow">Minhas metas</h2><button class="btn sm" id="g-new">+ Nova meta</button></div>
      ${S.goals.length ? S.goals.map(g => {
        const t = GOAL_TYPES[g.type], pr = goalProgress(g), pct = Math.max(0, Math.min(1, pr.pct));
        const name = g.type === 'carga' ? `+${fmtNum(g.target, 1)} kg em ${g.param}` : g.type === 'medida' ? `−${fmtNum(g.target, 1)} cm de ${MEASURES.find(m => m[0] === g.param)?.[1]}` : `${t.label}: ${fmtNum(g.target, g.type === 'peso' || g.type === 'km_semana' ? 1 : 0)}`;
        return `<div class="goal ${pct >= 1 ? 'hit' : ''}"><div class="row"><b class="grow">${pct >= 1 ? '✓ ' : ''}${esc(name)}</b><button class="icon-btn" data-del="${g.id}" aria-label="Excluir meta">✕</button></div>
          <div class="progress"><i style="width:${pct * 100}%"></i></div><div class="small muted">${esc(pr.text)}</div></div>`;
      }).join('') : '<p class="muted small">Crie metas como "treinar 5 vezes por semana", "150 min de cardio" ou "−3 cm de cintura".</p>'}
    </section>
    <section class="card">
      <h2>Conquistas <span class="badge done">${earned}/${list.length}</span></h2>
      <div class="medals">${list.map(x => `<div class="medal ${x.earned ? 'on' : ''}" title="${esc(x.desc)}">
        <span class="m-ico">${x.icon}</span><b>${esc(x.title)}</b><small>${x.earned ? 'Conquistada' : esc(x.desc)}</small>
        ${!x.earned && x.goal > 1 ? `<div class="progress thin"><i style="width:${Math.min(100, x.cur / x.goal * 100)}%"></i></div>` : ''}</div>`).join('')}</div>
    </section>`;
  $$('[data-del]', el).forEach(b => b.onclick = async () => {
    if (!confirm('Excluir esta meta?')) return;
    await setKV('goals', S.goals.filter(g => g.id !== b.dataset.del)); render(el);
  });
  $('#g-new', el).onclick = () => newGoal(() => render(el));
}

function newGoal(done) {
  const exNames = exerciseNames();
  const w = sheet(`<div class="row"><h2 class="grow">Nova meta</h2><button class="icon-btn" data-close aria-label="Fechar">✕</button></div>
    ${field('Tipo de meta', `<select id="ng-type">${Object.entries(GOAL_TYPES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select>`)}
    <div id="ng-param"></div>
    ${field('Valor', '<input type="number" inputmode="decimal" step="0.5" id="ng-target">')}
    <p class="small muted" id="ng-hint"></p>
    <button class="btn block" id="ng-save">Criar meta</button>`);
  const upd = () => {
    const k = $('#ng-type', w).value, t = GOAL_TYPES[k];
    $('#ng-hint', w).textContent = `${t.hint} (${t.unit})`;
    $('#ng-param', w).innerHTML = t.param === 'exercise'
      ? (exNames.length ? field('Exercício', `<select id="ng-p">${exNames.map(n => `<option>${esc(n)}</option>`).join('')}</select>`) : '<p class="small muted">Registre um treino de musculação primeiro.</p>')
      : t.param === 'measure' ? field('Medida', `<select id="ng-p">${MEASURES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`) : '';
  };
  $('#ng-type', w).onchange = upd; upd();
  $('#ng-save', w).onclick = async () => {
    const type = $('#ng-type', w).value, target = num($('#ng-target', w).value), param = $('#ng-p', w)?.value || null;
    if (!target || target <= 0) { toast('Informe um valor'); return; }
    if (GOAL_TYPES[type].param && !param) { toast('Escolha o item da meta'); return; }
    const base = type === 'carga' ? personalRecords(param)?.maxLoad.value ?? 0 : type === 'medida' ? latestMeasure(param) : type === 'peso' ? latestWeight() : null;
    if (type === 'medida' && base == null) { toast('Registre essa medida em Corpo e fotos primeiro'); return; }
    await setKV('goals', [...S.goals, { id: uid(), type, target, param, base, createdAt: todayISO() }]);
    toast('Meta criada'); w.remove(); done();
  };
}
