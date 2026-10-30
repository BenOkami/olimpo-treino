// Utilitários gerais: datas, formatação, geodistância, notificações.

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const pad = n => String(n).padStart(2, '0');

export const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => toISO(new Date());
export const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const dowIdx = iso => (parseISO(iso).getDay() + 6) % 7; // segunda = 0
export const weekStart = iso => addDays(iso, -dowIdx(iso));
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

export const DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const DAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const fmtDate = (iso, opts) => iso ? parseISO(iso).toLocaleDateString('pt-BR', opts || { day: '2-digit', month: '2-digit' }) : '';
export const fmtDateLong = iso => fmtDate(iso, { weekday: 'long', day: '2-digit', month: 'long' });
export const fmtDateFull = iso => fmtDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });

export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
export function fmtHours(sec) {
  const m = Math.round((sec || 0) / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${pad(m % 60)}min` : `${m}min`;
}
export function fmtPace(secPerKm) {
  if (!secPerKm || !isFinite(secPerKm)) return '--:--';
  let m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60);
  if (s === 60) { m++; s = 0; }
  return `${m}:${pad(s)}`;
}
export const fmtNum = (n, d = 1) => (+n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtInt = n => Math.round(+n || 0).toLocaleString('pt-BR');

// "1:02:03", "25:30" ou "25" (minutos) → segundos
export function parseDur(str) {
  if (str == null || str === '') return 0;
  const parts = String(str).trim().split(':').map(p => parseFloat(p.replace(',', '.')) || 0);
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
export const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : null; };

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sum = arr => arr.reduce((a, b) => a + (+b || 0), 0);
export const avg = arr => arr.length ? sum(arr) / arr.length : null;

export function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Estimativas de gasto calórico (aproximações de referência, não medições)
export const runKcal = (kg, km) => kg * km * 1.03;
export const metKcal = (met, kg, sec) => met * kg * sec / 3600;

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
