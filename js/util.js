// Small date and formatting helpers. Dates are stored as local 'YYYY-MM-DD' strings.

export function todayStr(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

export const dayOfWeek = s => parseDate(s).getDay();

export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

export const sum = (list, f) => list.reduce((total, x) => total + (Number(f(x)) || 0), 0);

export function groupBy(list, keyOf) {
  const out = {};
  for (const x of list) (out[keyOf(x)] ??= []).push(x);
  return out;
}

export const fmtNum = n => Math.round(Number(n) || 0).toLocaleString();

export function fmtMoney(n) {
  const v = Number(n) || 0;
  const cents = Math.round(v * 100) % 100 !== 0;
  return '$' + v.toLocaleString(undefined, { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
}

export function fmtDate(s) {
  const today = todayStr();
  if (s === today) return 'Today';
  if (s === addDays(today, -1)) return 'Yesterday';
  return parseDate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtMinutes(min) {
  const m = Math.round(Number(min) || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
