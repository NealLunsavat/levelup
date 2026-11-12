// Game feel: retro sound effects (synthesized with Web Audio, no files) and haptic taps.
// Both can be turned off per device in Settings.

const PREFS_KEY = 'levelup:fx';
let prefs = { sound: true, haptics: true };
try {
  prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS_KEY)) };
} catch {}

export const fxPrefs = () => prefs;
export function setFxPref(key, value) {
  prefs = { ...prefs, [key]: value };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

// ---- Sound ----

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // 'ambient' respects the silent switch and mixes with music or podcasts instead of pausing them.
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    } catch {}
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// iOS only allows audio after a user gesture, so wake the audio engine on the first touch or key.
const unlock = () => {
  audio();
  removeEventListener('pointerdown', unlock);
  removeEventListener('keydown', unlock);
};
addEventListener('pointerdown', unlock);
addEventListener('keydown', unlock);

function tone(freq, at, dur, { type = 'square', vol = 0.12, slide } = {}) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

const arpeggio = (notes, step, dur, opts) => notes.forEach((f, i) => tone(f, i * step, dur, opts));

const SOUNDS = {
  tap: () => tone(1200, 0, 0.04, { vol: 0.05 }),
  log: () => arpeggio([660, 990], 0.07, 0.1),
  tick: () => arpeggio([880, 1320], 0.05, 0.07, { vol: 0.08 }),
  quest: () => arpeggio([523, 659, 784, 1047], 0.07, 0.14),
  coin: () => {
    tone(988, 0, 0.08);
    tone(1319, 0.08, 0.35);
  },
  levelup: () => {
    arpeggio([392, 523, 659, 784], 0.09, 0.12);
    tone(1047, 0.38, 0.6, { type: 'sawtooth', vol: 0.07 });
    tone(1319, 0.38, 0.6, { vol: 0.06 });
    tone(1568, 0.62, 0.7, { vol: 0.06 });
  },
  alarm: () => [0, 0.2, 0.4].forEach(at => tone(440, at, 0.14, { type: 'sawtooth', vol: 0.08, slide: 880 })),
  win: () => arpeggio([784, 988, 1175, 1568], 0.06, 0.12),
  hit: () => tone(220, 0, 0.35, { type: 'sawtooth', vol: 0.1, slide: 55 }),
  shift: () => tone(180, 0, 0.5, { type: 'triangle', vol: 0.1, slide: 720 }),
};

export function play(name) {
  if (!prefs.sound || !SOUNDS[name]) return;
  try {
    if (audio()) SOUNDS[name]();
  } catch {}
}

// ---- Haptics ----

// iPhones have no Vibration API, but toggling a native switch control produces a real haptic tap
// (iOS 18+). Elsewhere navigator.vibrate is used when it exists.
function iosTap() {
  const label = document.createElement('label');
  label.ariaHidden = 'true';
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}

const PATTERNS = { light: [12], double: [40, 60, 40], heavy: [50, 50, 50, 50, 120] };

export function haptic(kind = 'light') {
  if (!prefs.haptics) return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind] ?? PATTERNS.light);
      return;
    }
    iosTap();
    if (kind !== 'light') setTimeout(iosTap, 120);
    if (kind === 'heavy') setTimeout(iosTap, 240);
  } catch {}
}

// One call for "something good happened": a sound plus a matching haptic.
export function feedback(sound, buzz = 'light') {
  play(sound);
  haptic(buzz);
}
