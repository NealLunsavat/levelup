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

// Money in whole cents, so $100.10 paid as two $50.05 payments really reaches zero.
export const cents = n => Math.round((Number(n) || 0) * 100);

// The Monday that starts the week a date falls in.
export const weekStart = s => addDays(s, -((dayOfWeek(s) + 6) % 7));

// A clock time on a date, as a timestamp: timeOn('2026-11-13', '21:00').
export function timeOn(s, hhmm) {
  const d = parseDate(s);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// "2h 5m" style time left.
export function fmtLeft(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d) return `${d}d ${h}h`;
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}
