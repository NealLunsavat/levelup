// Time-responsive themes. On "Auto" the look follows your day:
// 4:00–9:00 AM Iron Dungeon (red/black), 9:00 AM–5:00 PM Neon (yellow), 5:00 PM–4:00 AM Night City
// (cyan/purple). Each can also be picked by hand, per device.

const PREF_KEY = 'levelup:theme';

export const THEMES = {
  iron: { name: 'Iron Dungeon', icon: '🩸' },
  night: { name: 'Night City', icon: '🌃' },
  neon: { name: 'Neon', icon: '⚡' },
};

export function autoTheme(date = new Date()) {
  const m = date.getHours() * 60 + date.getMinutes();
  if (m >= 4 * 60 && m < 9 * 60) return 'iron';
  if (m >= 9 * 60 && m < 17 * 60) return 'neon';
  return 'night';
}

export function getThemePref() {
  try {
    const pref = localStorage.getItem(PREF_KEY);
    // Themes that were removed (like Daylight) fall back to Auto.
    return pref === 'auto' || THEMES[pref] ? pref : 'auto';
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
