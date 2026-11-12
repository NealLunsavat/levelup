// The "log an activity" sheet: pick what you did, fill a short form, earn XP.
import { html, useState } from '../vendor/preact-htm.js';
import { KINDS, logXP } from './game.js';
import { BEDTIME_CUTOFF, RECOVERY_SLEEP_HOURS, STEALTH_MIN_MINUTES, STEALTH_MULTIPLIER } from './rpgMath.js';
import { put, remove } from './store.js';
import { feedback, play } from './fx.js';
import { Sheet, useApp } from './components.js';
import { todayStr } from './util.js';

export const ART_FOCUS = ['Proportions', 'Faces', 'Eyes', 'Angles', 'Hands', 'Poses', 'Hair', 'Anatomy', 'Line art', 'Shading'];
const WORKOUT_TYPES = ['Push', 'Pull', 'Legs', 'Upper body', 'Lower body', 'Full body', 'Cardio', 'Other'];
const PLATFORMS = ['DoorDash', 'Spark Driver', 'Other'];
const CONTENT_TYPES = ['Shoot (Apple Log 2)', 'Edit (DaVinci Resolve)', 'Other'];
const GAMES = ['Cyberpunk 2077', 'Call of Duty', 'Other'];

// Starting values for each kind's choice fields.
const KIND_DEFAULTS = {
  shift: { platform: 'DoorDash' },
  workout: { category: 'Push' },
  content: { category: 'Edit (DaVinci Resolve)' },
  rest: { game: 'Cyberpunk 2077' },
};

// Which fields each kind keeps, and which of those are required.
const FIELDS = {
  payment: ['debtId', 'amount'],
  shift: ['platform', 'amount', 'hours', 'miles'],
  itshift: ['hours', 'pay', 'note'],
  study: ['minutes', 'topic', 'stealth'],
  quiz: ['score', 'topic'],
  draw: ['minutes', 'focus', 'note'],
  content: ['category', 'minutes', 'note'],
  workout: ['category', 'minutes', 'note'],
  pr: ['exercise', 'weight', 'reps'],
  meal: ['name', 'calories', 'protein'],
  macros: ['calories', 'protein', 'carbs', 'fat'],
  rest: ['game', 'minutes'],
  sleep: ['bedtime', 'hours'],
  career: ['questId', 'title', 'pack'],
  activity: ['minutes', 'note'],
};
const REQUIRED = {
  payment: { debtId: 'a debt', amount: 'an amount' },
  shift: { amount: 'what you earned' },
  itshift: { hours: 'hours worked' },
  study: { minutes: 'minutes' },
  quiz: { score: 'your score' },
  draw: { minutes: 'minutes' },
  content: { minutes: 'minutes' },
  workout: { minutes: 'minutes' },
  pr: { exercise: 'the exercise', weight: 'the weight' },
  meal: { name: 'what you ate' },
  macros: { calories: 'calories' },
  rest: { minutes: 'minutes' },
  sleep: { bedtime: 'your bedtime', hours: 'hours slept' },
  career: {},
  activity: { minutes: 'minutes' },
};

export function kindsForSkill(skill) {
  if (skill.custom) return ['activity'];
  return Object.keys(KINDS).filter(k => KINDS[k].skill === skill.id);
}

export function LogSheet({ initial, onClose }) {
  const ctx = useApp();
  const rec = initial.record;
  const onlySkill = initial.skill && ctx.skillMap[initial.skill];
  const onlyKinds = onlySkill ? kindsForSkill(onlySkill) : null;

  const [kind, setKind] = useState(rec?.kind ?? initial.kind ?? (onlyKinds?.length === 1 ? onlyKinds[0] : null));
  const [skillId, setSkillId] = useState(rec?.skill ?? initial.skill ?? null);
  const [f, setF] = useState(() => rec ? { ...rec } : {
    date: todayStr(),
    debtId: initial.debtId ?? ctx.game.bosses.find(b => !b.defeatedOn)?.id ?? '',
    focus: [],
    // Studying while the IT shift is open defaults to a Stealth Mission.
    stealth: initial.stealth ?? ctx.game.dungeonToday.some(q => q.id === 'it' && q.status === 'active'),
  });
  const [error, setError] = useState('');
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  if (!kind) {
    const groups = (onlySkill ? [onlySkill] : ctx.skills).map(s => ({ skill: s, kinds: kindsForSkill(s) }));
    return html`<${Sheet} title="What did you do?" onClose=${onClose}>
      ${groups.map(({ skill, kinds }) => html`<div class="pick-group">
        <div class="pick-label" style=${{ color: skill.color }}>${skill.icon} ${skill.name}</div>
        <div class="pick-grid">
          ${kinds.map(k => html`<button class="pick" onClick=${() => { setKind(k); setSkillId(skill.id); }}>
            <span class="pick-icon">${k === 'activity' ? skill.icon : KINDS[k].icon}</span>
            <span>${k === 'activity' ? `${skill.name} session` : KINDS[k].label}</span>
          </button>`)}
        </div>
      </div>`)}
    <//>`;
  }

  const skill = ctx.skillMap[KINDS[kind].skill ?? skillId];
  const label = kind === 'activity' ? `${skill?.name ?? 'Custom'} session` : KINDS[kind].label;
  const v = { ...KIND_DEFAULTS[kind], ...f };
  // Preview the XP after today's buffs and a Stealth Mission bonus, matching what buildGame will award.
  const it = ctx.game.dungeonToday.find(q => q.id === 'it');
  const stealthTotal = (it?.stealthMinutes ?? 0) + (Number(v.minutes) || 0) - (rec?.stealth ? Number(rec.minutes) || 0 : 0);
  const stealthBoost = kind === 'study' && v.stealth && it?.status === 'active' && stealthTotal >= STEALTH_MIN_MINUTES;
  const dayBoost = v.date === ctx.game.today ? ctx.game.multiplierNow : 1;
  const preview = Math.round(logXP({ ...v, kind }) * (stealthBoost ? STEALTH_MULTIPLIER : 1) * dayBoost);

  function save(e) {
    e.preventDefault();
    const missing = Object.entries(REQUIRED[kind]).filter(([k]) => {
      const x = v[k];
      return x === '' || x == null || (typeof x === 'number' && x <= 0 && k !== 'score');
    });
    if (missing.length) return setError(`Add ${missing.map(([, name]) => name).join(' and ')}.`);
    const out = { type: 'log', kind, skill: skill?.id ?? skillId, date: v.date || todayStr(), createdAt: rec?.createdAt ?? Date.now() };
    if (rec) out.id = rec.id;
    for (const k of FIELDS[kind]) if (v[k] !== '' && v[k] != null && v[k] !== false) out[k] = v[k];
    put(out);
    if (!rec) feedback(preview > 0 ? 'log' : 'tick');
    ctx.toast(rec ? 'Saved' : preview > 0 ? `+${preview} XP · ${skill?.icon ?? ''} ${skill?.name ?? ''}` : `${KINDS[kind].icon} ${label} logged`);
    onClose();
  }

  function del() {
    if (!confirm('Delete this entry? Its XP will be removed.')) return;
    remove(rec.id);
    play('hit');
    ctx.toast('Deleted');
    onClose();
  }

  const props = { f: v, set };
  return html`<${Sheet} title=${(rec ? 'Edit · ' : '') + label} onClose=${onClose}>
    <form class="form" onSubmit=${save}>
      ${kind === 'payment' && html`<${PaymentFields} ...${props} onClose=${onClose} />`}
      ${kind === 'shift' && html`
        <${Choice} label="Platform" options=${PLATFORMS} value=${v.platform} onChange=${x => set('platform', x)} />
        <div class="row">
          <${Num} label="Earned" k="amount" prefix="$" ...${props} />
          <${Num} label="Hours" k="hours" ...${props} />
          <${Num} label="Miles" k="miles" ...${props} />
        </div>`}
      ${kind === 'itshift' && html`
        <div class="row">
          <${Num} label="Hours" k="hours" ...${props} />
          <${Num} label="Pay (optional)" k="pay" prefix="$" ...${props} />
        </div>
        <${Text} label="Note" k="note" placeholder="e.g. LanceSoft help desk" ...${props} />`}
      ${kind === 'study' && html`
        <${Minutes} ...${props} />
        <${Text} label="Chapter / topic" k="topic" placeholder="e.g. Ch. 7: Flexibility training" ...${props} />
        <button type="button" class=${'toggle' + (v.stealth ? ' on' : '')} onClick=${() => set('stealth', !v.stealth)} aria-pressed=${!!v.stealth}>
          <span class="toggle-dot"></span>
          <span><b>🥷 Stealth Mission</b><br /><span class="tiny muted">Studied during your IT shift. 2 hours in one shift = 1.5× INT. Only counts if logged during the shift.</span></span>
        </button>`}
      ${kind === 'quiz' && html`
        <${Num} label="Score" k="score" suffix="%" ...${props} />
        <${Text} label="Topic" k="topic" placeholder="e.g. Chapters 1–5 review" ...${props} />`}
      ${kind === 'draw' && html`
        <${Minutes} ...${props} />
        <${Choice} label="Focus (pick any)" multi options=${ART_FOCUS} value=${v.focus || []} onChange=${x => set('focus', x)} />
        <${Text} label="Note" k="note" placeholder="What did you practice?" ...${props} />`}
      ${kind === 'content' && html`
        <${Choice} label="Type" options=${CONTENT_TYPES} value=${v.category} onChange=${x => set('category', x)} />
        <${Minutes} ...${props} />
        <${Text} label="Note" k="note" placeholder="e.g. Color graded leg day B-roll" ...${props} />`}
      ${kind === 'workout' && html`
        <${Choice} label="Type" options=${WORKOUT_TYPES} value=${v.category} onChange=${x => set('category', x)} />
        <${Minutes} ...${props} />
        <${Text} label="Note" k="note" placeholder="e.g. Bench 3×8 @ 155" ...${props} />`}
      ${kind === 'pr' && html`
        <${Text} label="Exercise" k="exercise" placeholder="e.g. Bench press" ...${props} />
        <div class="row">
          <${Num} label="Weight" k="weight" suffix="lb" ...${props} />
          <${Num} label="Reps" k="reps" ...${props} />
        </div>`}
      ${kind === 'meal' && html`<${MealFields} ...${props} />`}
      ${kind === 'macros' && html`
        <p class="muted small">Copy today's totals from MacroFactor. Within ±5% of your ${ctx.data.settings.calorieTarget} kcal target with ${ctx.data.settings.proteinTarget}g+ protein is a perfect day: bonus STR XP, and it cures Cyberpsychosis.</p>
        <div class="row">
          <${Num} label="Calories" k="calories" suffix="kcal" ...${props} />
          <${Num} label="Protein" k="protein" suffix="g" ...${props} />
        </div>
        <div class="row">
          <${Num} label="Carbs" k="carbs" suffix="g" ...${props} />
          <${Num} label="Fat" k="fat" suffix="g" ...${props} />
        </div>`}
      ${kind === 'sleep' && html`
        <p class="muted small">In bed after ${fmt12(BEDTIME_CUTOFF)} adds stress. ${RECOVERY_SLEEP_HOURS}+ hours cures Cyberpsychosis.</p>
        <label class="field"><span>Bedtime</span><input type="time" value=${v.bedtime ?? ''} onInput=${e => set('bedtime', e.target.value)} /></label>
        <${QuickNum} label="Hours slept" k="hours" options=${[6, 7, 8, 9]} ...${props} />`}
      ${kind === 'career' && html`<p class="small">🎯 ${v.title}</p>`}
      ${kind === 'rest' && html`
        <${Choice} label="Game" options=${GAMES} value=${v.game} onChange=${x => set('game', x)} />
        <${Minutes} ...${props} />`}
      ${kind === 'activity' && html`
        <${Minutes} ...${props} />
        <${Text} label="Note" k="note" ...${props} />`}

      <label class="field"><span>Date</span><input type="date" value=${v.date} max=${todayStr()} onInput=${e => set('date', e.target.value)} /></label>

      ${error && html`<p class="error">${error}</p>`}
      <div class="form-actions">
        ${rec && html`<button type="button" class="btn ghost danger-text" onClick=${del}>Delete</button>`}
        <button type="submit" class="btn primary grow">${rec ? 'Save' : preview > 0 ? `Claim +${preview} XP` : 'Log it'}</button>
      </div>
    </form>
  <//>`;
}

function PaymentFields({ f, set, onClose }) {
  const { game } = useApp();
  const open = game.bosses.filter(b => !b.defeatedOn || b.id === f.debtId);
  if (!game.bosses.length) {
    return html`<div class="notice">
      <p>Add the debt you're paying off as a <b>boss</b> first. Every payment knocks off some of its HP.</p>
      <a class="btn primary" href="#/skill/finance" onClick=${onClose}>Add a debt boss</a>
    </div>`;
  }
  return html`
    <label class="field"><span>Which debt?</span>
      <select value=${f.debtId} onChange=${e => set('debtId', e.target.value)}>
        <option value="" disabled>Choose a debt</option>
        ${open.map(b => html`<option value=${b.id}>${b.name} (${'$' + b.remaining.toLocaleString()} left)</option>`)}
      </select>
    </label>
    <${Num} label="Amount paid" k="amount" prefix="$" f=${f} set=${set} />`;
}

function MealFields({ f, set }) {
  const { data } = useApp();
  // Recent unique meals so repeat meals are one tap.
  const recent = [];
  for (const l of data.logs) {
    if (l.kind !== 'meal' || recent.some(m => m.name.toLowerCase() === l.name.toLowerCase())) continue;
    recent.push(l);
    if (recent.length === 8) break;
  }
  return html`
    ${recent.length > 0 && html`<div class="field"><span>Repeat a recent meal</span><div class="chip-row">
      ${recent.map(m => html`<button type="button" class="chip-btn" onClick=${() => { set('name', m.name); set('calories', m.calories ?? ''); set('protein', m.protein ?? ''); }}>${m.name}</button>`)}
    </div></div>`}
    <${Text} label="What did you eat?" k="name" placeholder="e.g. Chicken rice bowl" f=${f} set=${set} />
    <div class="row">
      <${Num} label="Calories" k="calories" suffix="kcal" f=${f} set=${set} />
      <${Num} label="Protein" k="protein" suffix="g" f=${f} set=${set} />
    </div>`;
}

const fmt12 = hhmm => new Date(`2000-01-01T${hhmm}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function QuickNum({ label, k, options, f, set }) {
  return html`<div class="field">
    <span>${label}</span>
    <div class="chip-row">
      ${options.map(n => html`<button type="button" class=${'chip-btn' + (f[k] === n ? ' on' : '')} onClick=${() => set(k, n)}>${n}</button>`)}
      <input class="mini-input" type="number" inputmode="decimal" step="any" min="0" placeholder="Other" aria-label=${label}
        value=${options.includes(f[k]) ? '' : f[k] ?? ''}
        onInput=${e => set(k, e.target.value === '' ? '' : Number(e.target.value))} />
    </div>
  </div>`;
}

function Minutes({ f, set }) {
  return html`<div class="field">
    <span>Minutes</span>
    <div class="chip-row">
      ${[15, 30, 45, 60, 90].map(m => html`<button type="button" class=${'chip-btn' + (f.minutes === m ? ' on' : '')} onClick=${() => set('minutes', m)}>${m}</button>`)}
      <input class="mini-input" type="number" inputmode="numeric" min="1" placeholder="Other" aria-label="Minutes"
        value=${[15, 30, 45, 60, 90].includes(f.minutes) ? '' : f.minutes ?? ''}
        onInput=${e => set('minutes', e.target.value === '' ? '' : Number(e.target.value))} />
    </div>
  </div>`;
}

export function Num({ label, k, f, set, prefix, suffix, placeholder }) {
  return html`<label class="field"><span>${label}</span>
    <div class="input-wrap">
      ${prefix && html`<em>${prefix}</em>`}
      <input type="number" inputmode="decimal" step="any" min="0" placeholder=${placeholder ?? ''} value=${f[k] ?? ''}
        onInput=${e => set(k, e.target.value === '' ? '' : Number(e.target.value))} />
      ${suffix && html`<em>${suffix}</em>`}
    </div>
  </label>`;
}

export function Text({ label, k, f, set, placeholder }) {
  return html`<label class="field"><span>${label}</span>
    <input type="text" placeholder=${placeholder ?? ''} value=${f[k] ?? ''} onInput=${e => set(k, e.target.value)} />
  </label>`;
}

export function Choice({ label, options, value, onChange, multi }) {
  const isOn = o => (multi ? value.includes(o) : value === o);
  const toggle = o => onChange(multi ? (isOn(o) ? value.filter(x => x !== o) : [...value, o]) : o);
  return html`<div class="field"><span>${label}</span>
    <div class="chip-row">
      ${options.map(o => html`<button type="button" class=${'chip-btn' + (isOn(o) ? ' on' : '')} onClick=${() => toggle(o)}>${o}</button>`)}
    </div>
  </div>`;
}
