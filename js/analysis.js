// Análise do histórico: consistência, carga, recuperação, recordes e sugestões de progressão.
// Regras conservadoras: nunca aumenta intensidade sozinho e não faz diagnósticos.
import { S } from './store.js';
import { addDays, todayISO, weekStart, sum, avg, fmtNum, fmtPace, daysBetween } from './util.js';
import { activeItemsFor, sessionFor } from './schedule.js';

/* ---------- agregados ---------- */

export const strengthVolume = s => sum((s.exercises || []).map(e =>
  e.unit === 's' ? 0 : sum(e.sets.filter(x => x.done).map(x => (+x.load || 0) * (+x.reps || 0)))));

export const runs = () => S.sessions.filter(s => s.kind === 'run' && s.distanceKm > 0);
export const strengthSessions = () => S.sessions.filter(s => s.kind === 'strength');
export const training = () => S.sessions.filter(s => s.kind !== 'rest');

export function weeksBack(n, today = todayISO()) {
  const ws = weekStart(today);
  return [...Array(n)].map((_, i) => addDays(ws, -7 * (n - 1 - i)));
}

export function sumRange(from, to, fn, kind) {
  return sum(S.sessions.filter(s => (!kind || s.kind === kind) && s.date >= from && s.date <= to).map(fn));
}
export const sumWeek = (ws, fn, kind) => sumRange(ws, addDays(ws, 6), fn, kind);

const sessionLoad = s => (s.durationSec || 0) / 60 * (s.rpe || 6);

/* ---------- consistência, carga e recuperação ---------- */

export function adherence(days = 28, today = todayISO()) {
  let planned = 0, done = 0;
  for (let i = 1; i <= days; i++) {
    for (const it of activeItemsFor(addDays(today, -i))) {
      if (it.type === 'rest') continue;
      planned++;
      if (sessionFor(it)) done++;
    }
  }
  return { planned, done, rate: planned ? done / planned : null };
}

export function insights(today = todayISO()) {
  const out = [];
  const tr = training();
  if (!tr.length) {
    return [{ level: 'info', area: 'geral', title: 'Comece seu histórico', text: 'Registre os primeiros treinos. A análise de consistência, carga e recuperação aparece automaticamente com os dados.' }];
  }
  const firstDate = tr[0].date;
  const historyDays = daysBetween(firstDate, today);

  // Consistência
  const ad = adherence(28, today);
  if (ad.rate != null && ad.planned >= 4) {
    const pct = Math.round(ad.rate * 100);
    if (ad.rate >= 0.8) out.push({ level: 'ok', area: 'consistencia', title: `Consistência alta: ${pct}%`, text: `${ad.done} de ${ad.planned} atividades planejadas nas últimas 4 semanas foram concluídas.` });
    else if (ad.rate >= 0.5) out.push({ level: 'info', area: 'consistencia', title: `Consistência moderada: ${pct}%`, text: `${ad.done} de ${ad.planned} atividades concluídas em 4 semanas. Remarcar treinos perdidos ajuda a manter a regularidade.` });
    else out.push({ level: 'warn', area: 'consistencia', title: `Consistência baixa: ${pct}%`, text: `Apenas ${ad.done} de ${ad.planned} atividades concluídas em 4 semanas. Talvez valha ajustar a programação à sua rotina.` });
  }

  // Relação carga aguda : crônica (sRPE = minutos × percepção de esforço)
  if (historyDays >= 21) {
    const acute = sumRange(addDays(today, -6), today, sessionLoad);
    const chronic = sumRange(addDays(today, -27), today, sessionLoad) / 4;
    if (chronic > 0) {
      const r = acute / chronic;
      if (r > 1.5) out.push({ level: 'warn', area: 'carga', title: 'Aumento brusco de carga', text: `A carga dos últimos 7 dias está ${fmtNum((r - 1) * 100, 0)}% acima da sua média do mês. Aumentos rápidos elevam o risco de sobrecarga — considere manter ou reduzir na próxima semana.` });
      else if (r < 0.7 && acute > 0) out.push({ level: 'info', area: 'carga', title: 'Semana mais leve que o habitual', text: 'Sua carga recente está abaixo da média do mês. Se não foi planejado, retome aos poucos, sem compensar tudo de uma vez.' });
    }
  }

  // Salto de volume na corrida
  const kmNow = sumRange(addDays(today, -6), today, s => s.distanceKm, 'run');
  const kmPrev = sumRange(addDays(today, -13), addDays(today, -7), s => s.distanceKm, 'run');
  if (kmPrev >= 3 && kmNow > kmPrev * 1.3) {
    out.push({ level: 'warn', area: 'carga', title: 'Volume de corrida subiu rápido', text: `${fmtNum(kmNow)} km nos últimos 7 dias contra ${fmtNum(kmPrev)} km na semana anterior (+${fmtNum((kmNow / kmPrev - 1) * 100, 0)}%). O recomendado é progredir aos poucos.` });
  }

  // Esforço muito alto em sequência
  const last3 = tr.slice(-3);
  if (last3.length === 3 && last3.every(s => (s.rpe || 0) >= 9)) {
    out.push({ level: 'warn', area: 'recuperacao', title: 'Esforço muito alto em sequência', text: 'As 3 últimas sessões tiveram percepção de esforço 9 ou 10. Intercalar sessões mais leves favorece a recuperação.' });
  }

  // Dias seguidos sem descanso
  let streak = 0;
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, -i);
    if (tr.some(s => s.date === d)) streak++; else if (i > 0) break;
  }
  if (streak >= 7) out.push({ level: 'warn', area: 'recuperacao', title: `${streak} dias seguidos treinando`, text: 'Inclua pelo menos um dia de recuperação. É no descanso que o corpo se adapta ao treino.' });

  out.push(...recoveryInsights(today));

  if (!out.some(i => i.level === 'warn')) {
    out.push({ level: 'ok', area: 'geral', title: 'Carga e recuperação equilibradas', text: 'Nenhum sinal de excesso de carga ou recuperação insuficiente nos dados registrados.' });
  }
  return out;
}

export function recoveryInsights(today = todayISO()) {
  const out = [];
  const rec = S.recovery.filter(r => r.date >= addDays(today, -6) && r.date <= today);
  if (!rec.length) return out;
  const sleep = avg(rec.map(r => r.sleepHours).filter(Boolean));
  const quality = avg(rec.map(r => r.sleepQuality).filter(Boolean));
  const energy = avg(rec.map(r => r.energy).filter(Boolean));
  const latest = rec.at(-1);
  if (sleep != null && sleep < 6.5) out.push({ level: 'warn', area: 'recuperacao', title: `Sono curto: média de ${fmtNum(sleep)} h`, text: 'Dormir pouco reduz a recuperação e o desempenho. Considere sessões mais leves até o sono normalizar.' });
  else if (quality != null && quality <= 2) out.push({ level: 'warn', area: 'recuperacao', title: 'Qualidade do sono baixa', text: 'Você relatou sono de baixa qualidade nesta semana. Atenção à recuperação antes de treinos intensos.' });
  if (energy != null && energy <= 2) out.push({ level: 'warn', area: 'recuperacao', title: 'Disposição baixa', text: 'Sua disposição média está baixa. Pode ser sinal de recuperação insuficiente — mantenha a intensidade e priorize o descanso.' });
  if ((latest.soreness || 0) >= 4) out.push({ level: 'warn', area: 'recuperacao', title: 'Cansaço muscular elevado', text: 'Você relatou cansaço muscular alto no último registro. Prefira atividades leves ou outro grupo muscular.' });
  if (latest.painAreas?.length && !latest.painAreas.includes('nenhuma')) {
    out.push({ level: 'warn', area: 'dor', title: 'Dor relatada', text: `Você registrou dor (${latest.painAreas.join(', ')}${latest.painLevel ? `, intensidade ${latest.painLevel}/10` : ''}). Reduza a carga na região e, se a dor persistir ou piorar, procure um profissional de saúde. O app não diagnostica lesões.` });
  }
  return out;
}

export const recoveryFlag = (today = todayISO()) =>
  insights(today).some(i => i.level === 'warn' && ['recuperacao', 'dor', 'carga'].includes(i.area));

/* ---------- musculação ---------- */

export function exerciseHistory(name) {
  const key = name.trim().toLowerCase();
  const out = [];
  for (const s of strengthSessions()) {
    const e = (s.exercises || []).find(x => x.name.trim().toLowerCase() === key);
    if (!e) continue;
    const done = e.sets.filter(x => x.done && +x.reps > 0);
    if (!done.length) continue;
    const top = Math.max(...done.map(x => +x.load || 0));
    const atTop = done.filter(x => (+x.load || 0) === top);
    out.push({
      date: s.date, sessionId: s.id, sets: done, unit: e.unit,
      topLoad: top,
      topReps: Math.max(...atTop.map(x => +x.reps)),
      totalReps: sum(done.map(x => x.reps)),
      volume: e.unit === 's' ? 0 : sum(done.map(x => (+x.load || 0) * (+x.reps || 0))),
      e1rm: Math.max(...done.map(x => (+x.load || 0) * (1 + (+x.reps) / 30))),
    });
  }
  return out;
}

export function exerciseNames() {
  const set = new Set();
  for (const s of strengthSessions()) for (const e of s.exercises || []) if (e.sets.some(x => x.done)) set.add(e.name);
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

const GOAL_REPS = {
  hipertrofia: 'Faixa de 8–12 repetições com controle total do movimento.',
  emagrecimento: 'Faixas de 12–15 repetições e descansos mais curtos ajudam no gasto energético.',
  condicionamento: 'Faixas de 10–15 repetições com boa técnica.',
  corrida: 'Musculação de suporte: foque em técnica e estabilidade, sem chegar à falha antes das corridas.',
  recomposicao: 'Faixa de 8–12 repetições, priorizando manter ou subir cargas aos poucos.',
};
export const goalRepNote = () => GOAL_REPS[S.profile.goal] || '';

// Progressão dupla: só sugere +carga quando todas as séries chegaram ao topo da faixa.
export function strengthSuggestion(ex, flag) {
  const hist = exerciseHistory(ex.name);
  const last = hist.at(-1);
  if (!last) return { load: null, text: 'Primeira vez: escolha uma carga que permita completar as repetições com boa técnica.' };
  const unit = ex.unit === 's' ? 's' : 'reps';
  if (flag) return { load: last.topLoad, text: `Sinais de recuperação insuficiente: mantenha ${fmtNum(last.topLoad, 1)} kg hoje.` };
  const atTop = last.sets.filter(x => (+x.load || 0) === last.topLoad);
  const allMax = atTop.length >= Math.min(ex.sets, last.sets.length) && atTop.every(x => +x.reps >= ex.repMax);
  if (allMax && ex.unit !== 's' && last.topLoad > 0) {
    const inc = Math.max(1, Math.round(last.topLoad * 0.025 * 2) / 2);
    return { load: last.topLoad + inc, text: `Você completou ${ex.repMax} ${unit} em todas as séries. Sugestão opcional: ${fmtNum(last.topLoad + inc, 1)} kg (+${fmtNum(inc, 1)} kg). Só aumente se a técnica estiver sólida.` };
  }
  if (allMax && ex.unit === 's') return { load: last.topLoad, text: `Meta atingida. Se estiver confortável, tente +5 s por série.` };
  return { load: last.topLoad, text: `Mantenha ${fmtNum(last.topLoad, 1)} kg e busque +1 ${unit === 's' ? 'segundo' : 'repetição'} por série até ${ex.repMax}.` };
}

/* ---------- corrida ---------- */

export function bestEffort(k) {
  let best = null;
  for (const r of runs()) {
    const sp = (r.splits || []).map(s => s.sec);
    if (sp.length >= k) {
      for (let i = 0; i + k <= sp.length; i++) {
        const t = sum(sp.slice(i, i + k));
        if (!best || t < best.sec) best = { sec: t, date: r.date, id: r.id };
      }
    } else if (Math.abs(r.distanceKm - k) <= k * 0.03) {
      const t = r.durationSec * k / r.distanceKm;
      if (!best || t < best.sec) best = { sec: t, date: r.date, id: r.id };
    }
  }
  return best;
}

export function runTotals(today = todayISO()) {
  const rs = runs();
  const ws = weekStart(today), month = today.slice(0, 7);
  const totalKm = sum(rs.map(r => r.distanceKm));
  const totalSec = sum(rs.map(r => r.durationSec));
  const paces = rs.map(r => r.bestPaceSec || r.avgPaceSec).filter(p => p > 0);
  return {
    count: rs.length,
    weekKm: sum(rs.filter(r => r.date >= ws && r.date <= today).map(r => r.distanceKm)),
    monthKm: sum(rs.filter(r => r.date.startsWith(month)).map(r => r.distanceKm)),
    totalKm, totalSec,
    avgPace: totalKm ? totalSec / totalKm : null,
    bestPace: paces.length ? Math.min(...paces) : null,
    longest: rs.reduce((m, r) => (!m || r.distanceKm > m.distanceKm ? r : m), null),
  };
}

export function firstVsLatest() {
  const rs = runs();
  if (rs.length < 2) return null;
  const a = rs[0], b = rs.at(-1);
  return {
    first: a, latest: b,
    distPct: (b.distanceKm / a.distanceKm - 1) * 100,
    paceDiff: a.avgPaceSec - b.avgPaceSec, // positivo = melhorou
    speedPct: (b.avgSpeed / a.avgSpeed - 1) * 100,
    timeDiff: b.durationSec - a.durationSec,
  };
}

// Progressão gradual de volume (teto semanal por nível) e manutenção quando há sinais de alerta.
export function runSuggestion(today = todayISO()) {
  const lvl = S.profile.experience || 'iniciante';
  const cap = { iniciante: 0.05, intermediario: 0.08, avancado: 0.1 }[lvl];
  const T = S.templates.run;
  const flag = recoveryFlag(today);
  const ws = weekStart(today);
  const weeks = [1, 2, 3].map(i => sumWeek(addDays(ws, -7 * i), r => r.distanceKm, 'run'));
  const withRuns = weeks.filter(k => k > 0);
  const rs = runs();
  const lastA = [...rs].reverse().find(r => r.runType === 'A');
  const lastB = [...rs].reverse().find(r => r.runType === 'B');
  const lines = [];

  if (!rs.length) {
    const start = lvl === 'iniciante'
      ? 'Corrida A: 20–25 min alternando 2 min de trote leve e 1 min de caminhada.'
      : 'Corrida A: 25–30 min em ritmo confortável (você deve conseguir conversar).';
    return {
      weeklyKm: null, flag, lines: [start, 'Corrida B: aquecimento de 10 min + 6 × 30 s um pouco mais rápido com 90 s de recuperação caminhando.', 'Registre as primeiras corridas para que a progressão use os seus dados reais.'],
      apply: { A: { targetMin: lvl === 'iniciante' ? 22 : 28, targetKm: T.A.targetKm }, B: { intervals: 6, workSec: 30, recSec: 90 } },
    };
  }

  const base = withRuns.length ? Math.max(weeks[0], avg(withRuns)) : sum(rs.slice(-2).map(r => r.distanceKm));
  const weeklyKm = flag ? base * 0.9 : base * (1 + cap);
  const aKm = lastA ? (flag ? lastA.distanceKm : lastA.distanceKm * (1 + cap)) : weeklyKm * 0.6;
  const aMin = lastA ? Math.round((flag ? lastA.durationSec : lastA.durationSec * (1 + cap)) / 60) : T.A.targetMin;

  if (flag) lines.push('Há sinais de carga alta ou recuperação insuficiente: a sugestão é manter ou reduzir levemente o volume desta semana.');
  lines.push(`Volume semanal sugerido: ~${fmtNum(weeklyKm)} km (${flag ? '−10%' : `+${Math.round(cap * 100)}% no máximo`} em relação à sua média recente de ${fmtNum(base)} km).`);
  lines.push(`Corrida A: ~${fmtNum(aKm)} km ou ${aMin} min em ritmo confortável${lastA ? ` (última: ${fmtNum(lastA.distanceKm)} km a ${fmtPace(lastA.avgPaceSec)}/km)` : ''}.`);

  let bIntervals = T.B.intervals;
  if (lastB) {
    const done = lastB.intervals?.length || 0;
    const easy = (lastB.rpe || 10) <= 7;
    if (!flag && done >= T.B.intervals && easy && T.B.intervals < 10) {
      bIntervals = T.B.intervals + 1;
      lines.push(`Corrida B: você completou ${done} tiros com esforço controlado. Opcional: ${bIntervals} × ${T.B.workSec} s. Mantenha ${T.B.intervals} se preferir.`);
    } else {
      lines.push(`Corrida B: mantenha ${T.B.intervals} × ${T.B.workSec} s com ${T.B.recSec} s de recuperação${lastB.bestPaceSec ? `; melhor ritmo até agora ${fmtPace(lastB.bestPaceSec)}/km` : ''}.`);
    }
  } else {
    lines.push(`Corrida B: ${T.B.intervals} × ${T.B.workSec} s forte com ${T.B.recSec} s de recuperação.`);
  }
  if (S.profile.goal === 'emagrecimento') lines.push('Para emagrecimento, priorize a duração em ritmo leve; consistência importa mais que velocidade.');
  if (S.profile.goal === 'corrida') lines.push('Para melhorar a corrida, mantenha cerca de 80% do volume em ritmo leve e concentre a intensidade na Corrida B.');

  return {
    weeklyKm, flag, lines,
    apply: { A: { targetMin: aMin, targetKm: +aKm.toFixed(1) }, B: { intervals: bIntervals } },
  };
}

/* ---------- corpo ---------- */

export const latestWeight = (upTo = '9999-12-31') => {
  const r = [...S.body].reverse().find(b => b.weight && b.date <= upTo);
  return r?.weight || +S.profile.weightKg || null;
};

/* ---------- recordes pessoais ---------- */

export function personalRecords(name) {
  const h = exerciseHistory(name);
  if (!h.length) return null;
  const best = (f) => h.reduce((m, x) => (f(x) > f(m) ? x : m), h[0]);
  const maxLoad = best(x => x.topLoad), maxReps = best(x => Math.max(...x.sets.map(s => +s.reps))), maxVol = best(x => x.volume), maxE1 = best(x => x.e1rm);
  return {
    maxLoad: { value: maxLoad.topLoad, reps: maxLoad.topReps, date: maxLoad.date },
    maxReps: { value: Math.max(...maxReps.sets.map(s => +s.reps)), date: maxReps.date },
    maxVolume: { value: maxVol.volume, date: maxVol.date },
    bestE1rm: { value: maxE1.e1rm, date: maxE1.date },
    sessions: h.length, unit: h[0].unit,
  };
}

// Recordes batidos em uma sessão (comparando com todo o histórico anterior a ela)
export function sessionPRs(session) {
  const out = [];
  for (const e of session.exercises || []) {
    const done = e.sets.filter(x => x.done && +x.reps > 0);
    if (!done.length || e.unit === 's') continue;
    const prev = exerciseHistory(e.name).filter(h => h.sessionId !== session.id && h.date <= session.date);
    if (!prev.length) continue;
    const top = Math.max(...done.map(x => +x.load || 0));
    const prevTop = Math.max(...prev.map(h => h.topLoad));
    if (top > prevTop) out.push(`${e.name}: ${fmtNum(top, 1)} kg (antes ${fmtNum(prevTop, 1)} kg)`);
  }
  return out;
}
