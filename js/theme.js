// Time-responsive themes. On "Auto" the look follows your day:
// 5:00–9:30 AM Iron Dungeon (red/black), 9:30 AM–8:00 PM Daylight (bright, readable while driving),
// 8:00 PM–5:00 AM Night City (cyan/purple). Each can also be picked by hand, per device.

const PREF_KEY = 'levelup:theme';

export const THEMES = {
  iron: { name: 'Iron Dungeon', icon: '🩸' },
  day: { name: 'Daylight', icon: '☀️' },
  night: { name: 'Night City', icon: '🌃' },
  neon: { name: 'Neon', icon: '⚡' },
};

export function autoTheme(date = new Date()) {
  const m = date.getHours() * 60 + date.getMinutes();
  if (m >= 5 * 60 && m < 9 * 60 + 30) return 'iron';
  if (m >= 9 * 60 + 30 && m < 20 * 60) return 'day';
  return 'night';
}

export function getThemePref() {
  try {
    return localStorage.getItem(PREF_KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

export function setThemePref(pref) {
  try {
    localStorage.setItem(PREF_KEY, pref);
  } catch {}
}

export const resolveTheme = (pref, date) => (pref === 'auto' ? autoTheme(date) : pref);

export function applyTheme(theme) {
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;
  root.dataset.theme = theme;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}
