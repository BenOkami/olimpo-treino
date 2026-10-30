// Gráficos SVG leves (sem dependências), dimensionados à largura real do conteúdo.
import { esc, fmtNum } from './util.js';

const chartWidth = () => Math.max(300, Math.min(720, (document.querySelector('main')?.clientWidth || 360) - 34));

function empty(msg, H) {
  return `<div class="chart-empty" style="height:${Math.round(H * 0.6)}px">${esc(msg)}</div>`;
}

function legend(series) {
  if (series.length < 2) return '';
  return `<div class="legend">${series.map(s => `<span><i class="dot" style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}

function xTicks(labels, x, H, B) {
  const n = labels.length;
  const idx = n <= 6 ? labels.map((_, i) => i) : [...new Set([0, Math.round((n - 1) / 3), Math.round(2 * (n - 1) / 3), n - 1])];
  return idx.map(i => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="ax">${esc(labels[i])}</text>`).join('');
}

/** series: [{name, color, values:[n|null]}], labels: [string] */
export function lineChart(series, { labels, height = 190, yFmt = v => fmtNum(v, 0), invert = false, zero = false, emptyMsg = 'Dados insuficientes ainda' } = {}) {
  const vals = series.flatMap(s => s.values).filter(v => v != null && isFinite(v));
  if (!vals.length) return empty(emptyMsg, height);
  const W = chartWidth(), H = height, L = 46, R = 14, T = 14, B = 24;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { const d = Math.abs(lo) * 0.1 || 1; lo -= d; hi += d; }
  else { const p = (hi - lo) * 0.12; lo -= p; hi += p; }
  if (zero) lo = Math.min(0, lo);
  const iw = W - L - R, ih = H - T - B, n = labels.length;
  const x = i => L + (n <= 1 ? iw / 2 : i * iw / (n - 1));
  const y = v => { const f = (v - lo) / (hi - lo); return invert ? T + f * ih : T + ih - f * ih; };
  let g = '';
  for (let k = 0; k <= 3; k++) {
    const v = lo + (hi - lo) * k / 3, yy = y(v);
    g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="gl"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" class="ax">${esc(yFmt(v))}</text>`;
  }
  let p = '';
  for (const s of series) {
    let d = '', pen = false;
    s.values.forEach((v, i) => {
      if (v == null || !isFinite(v)) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
    });
    p += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.values.forEach((v, i) => { if (v != null && isFinite(v)) p += `<circle cx="${x(i)}" cy="${y(v)}" r="${n > 30 ? 2 : 3.5}" fill="${s.color}"><title>${esc(labels[i])}: ${esc(yFmt(v))}</title></circle>`; });
    const li = s.values.map((v, i) => (v != null && isFinite(v) ? i : -1)).filter(i => i >= 0).at(-1);
    if (li != null && series.length === 1) p += `<text x="${Math.min(x(li), W - R - 4)}" y="${y(s.values[li]) - 9}" text-anchor="end" class="val">${esc(yFmt(s.values[li]))}</text>`;
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}${p}${xTicks(labels, x, H, B)}</svg>${legend(series)}`;
}

/** Barras agrupadas. series: [{name, color, values}] */
export function barChart(series, { labels, height = 190, yFmt = v => fmtNum(v, 0), emptyMsg = 'Sem registros neste período' } = {}) {
  const vals = series.flatMap(s => s.values).map(v => +v || 0);
  const max = Math.max(0, ...vals);
  if (!max) return empty(emptyMsg, height);
  const W = chartWidth(), H = height, L = 46, R = 10, T = 16, B = 24;
  const iw = W - L - R, ih = H - T - B, n = labels.length, k = series.length;
  const hi = max * 1.15;
  const slot = iw / n, bw = Math.max(3, Math.min(28, (slot * 0.7) / k));
  const x = i => L + slot * i + slot / 2;
  const y = v => T + ih - (v / hi) * ih;
  let g = '';
  for (let j = 0; j <= 3; j++) {
    const v = hi * j / 3, yy = y(v);
    g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="gl"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" class="ax">${esc(yFmt(v))}</text>`;
  }
  let b = '';
  series.forEach((s, si) => s.values.forEach((v, i) => {
    v = +v || 0; if (!v) return;
    const bx = x(i) - (k * bw) / 2 + si * bw;
    b += `<rect x="${bx.toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${(T + ih - y(v)).toFixed(1)}" rx="3" fill="${s.color}"><title>${esc(labels[i])} – ${esc(s.name)}: ${esc(yFmt(v))}</title></rect>`;
  }));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}${b}${xTicks(labels, x, H, B)}</svg>${legend(series)}`;
}

/** Traçado do percurso GPS (projeção equiretangular). route: [[lat,lng,t,novoSegmento?]] */
export function routeSvg(route, height = 220) {
  if (!route || route.length < 2) return empty('Sem trajeto GPS registrado', height);
  const W = chartWidth(), H = height, P = 14;
  const lat0 = route[0][0] * Math.PI / 180;
  const pts = route.map(p => [p[1] * Math.cos(lat0), -p[0], p[3]]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sc = Math.min((W - 2 * P) / (maxX - minX || 1e-9), (H - 2 * P) / (maxY - minY || 1e-9));
  const ox = (W - (maxX - minX) * sc) / 2, oy = (H - (maxY - minY) * sc) / 2;
  const X = p => (ox + (p[0] - minX) * sc).toFixed(1), Y = p => (oy + (p[1] - minY) * sc).toFixed(1);
  let d = '';
  pts.forEach((p, i) => { d += `${i === 0 || p[2] ? 'M' : 'L'}${X(p)},${Y(p)}`; });
  const a = pts[0], z = pts.at(-1);
  return `<svg class="chart route" viewBox="0 0 ${W} ${H}" width="100%" role="img"><path d="${d}" fill="none" stroke="var(--run)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(a)}" cy="${Y(a)}" r="6" fill="var(--ok)"/><circle cx="${X(z)}" cy="${Y(z)}" r="6" fill="var(--danger)"/></svg>`;
}
