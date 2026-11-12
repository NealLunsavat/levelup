// The "log an activity" sheet: pick what you did, fill a short form, earn XP.
import { html, useState } from '../vendor/preact-htm.js';
import { KINDS, logXP } from './game.js';
import { put, remove } from './store.js';
import { Sheet, useApp } from './components.js';
import { todayStr } from './util.js';

export const ART_FOCUS = ['Proportions', 'Faces', 'Eyes', 'Angles', 'Hands', 'Poses', 'Hair', 'Anatomy', 'Line art', 'Shading'];
const WORKOUT_TYPES = ['Push', 'Pull', 'Legs', 'Upper body', 'Lower body', 'Full body', 'Cardio', 'Other'];
const PLATFORMS = ['DoorDash', 'Spark Driver', 'Other'];

// Which fields each kind keeps, and which of those are required.
const FIELDS = {
  payment: ['debtId', 'amount'],
  shift: ['platform', 'amount', 'hours', 'miles'],
  study: ['minutes', 'topic'],
  quiz: ['score', 'topic'],
  draw: ['minutes', 'focus', 'note'],
  workout: ['category', 'minutes', 'note'],
  pr: ['exercise', 'weight', 'reps'],
  meal: ['name', 'calories', 'protein'],
  activity: ['minutes', 'note'],
};
const REQUIRED = {
  payment: { debtId: 'a debt', amount: 'an amount' },
  shift: { amount: 'what you earned' },
  study: { minutes: 'minutes' },
  quiz: { score: 'your score' },
  draw: { minutes: 'minutes' },
  workout: { minutes: 'minutes' },
  pr: { exercise: 'the exercise', weight: 'the weight' },
  meal: { name: 'what you ate' },
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
    platform: 'DoorDash',
    category: 'Push',
    focus: [],
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
  const preview = logXP({ ...f, kind });

  function save(e) {
    e.preventDefault();
    const missing = Object.entries(REQUIRED[kind]).filter(([k]) => {
      const v = f[k];
      return v === '' || v == null || (typeof v === 'number' && v <= 0 && k !== 'score');
    });
    if (missing.length) return setError(`Add ${missing.map(([, name]) => name).join(' and ')}.`);
    const out = { type: 'log', kind, skill: skill?.id ?? skillId, date: f.date || todayStr(), createdAt: rec?.createdAt ?? Date.now() };
    if (rec) out.id = rec.id;
    for (const k of FIELDS[kind]) if (f[k] !== '' && f[k] != null) out[k] = f[k];
    const saved = put(out);
    ctx.toast(rec ? 'Saved' : `+${logXP(saved)} XP · ${skill?.icon ?? ''} ${skill?.name ?? ''}`);
    onClose();
  }

  function del() {
    if (!confirm('Delete this entry? Its XP will be removed.')) return;
    remove(rec.id);
    ctx.toast('Deleted');
    onClose();
  }

  const props = { f, set };
  return html`<${Sheet} title=${(rec ? 'Edit · ' : '') + label} onClose=${onClose}>
    <form class="form" onSubmit=${save}>
      ${kind === 'payment' && html`<${PaymentFields} ...${props} onClose=${onClose} />`}
      ${kind === 'shift' && html`
        <${Choice} label="Platform" options=${PLATFORMS} value=${f.platform} onChange=${v => set('platform', v)} />
        <div class="row">
          <${Num} label="Earned" k="amount" prefix="$" ...${props} />
          <${Num} label="Hours" k="hours" ...${props} />
          <${Num} label="Miles" k="miles" ...${props} />
        </div>`}
      ${kind === 'study' && html`
        <${Minutes} ...${props} />
        <${Text} label="Chapter / topic" k="topic" placeholder="e.g. Ch. 7: Flexibility training" ...${props} />`}
      ${kind === 'quiz' && html`
        <${Num} label="Score" k="score" suffix="%" ...${props} />
        <${Text} label="Topic" k="topic" placeholder="e.g. Chapters 1–5 review" ...${props} />`}
      ${kind === 'draw' && html`
        <${Minutes} ...${props} />
        <${Choice} label="Focus (pick any)" multi options=${ART_FOCUS} value=${f.focus || []} onChange=${v => set('focus', v)} />
        <${Text} label="Note" k="note" placeholder="What did you practice?" ...${props} />`}
      ${kind === 'workout' && html`
        <${Choice} label="Type" options=${WORKOUT_TYPES} value=${f.category} onChange=${v => set('category', v)} />
        <${Minutes} ...${props} />
        <${Text} label="Note" k="note" placeholder="e.g. Bench 3×8 @ 155" ...${props} />`}
      ${kind === 'pr' && html`
        <${Text} label="Exercise" k="exercise" placeholder="e.g. Bench press" ...${props} />
        <div class="row">
          <${Num} label="Weight" k="weight" suffix="lb" ...${props} />
          <${Num} label="Reps" k="reps" ...${props} />
        </div>`}
      ${kind === 'meal' && html`<${MealFields} ...${props} />`}
      ${kind === 'activity' && html`
        <${Minutes} ...${props} />
        <${Text} label="Note" k="note" ...${props} />`}

      <label class="field"><span>Date</span><input type="date" value=${f.date} max=${todayStr()} onInput=${e => set('date', e.target.value)} /></label>

      ${error && html`<p class="error">${error}</p>`}
      <div class="form-actions">
        ${rec && html`<button type="button" class="btn ghost danger-text" onClick=${del}>Delete</button>`}
        <button type="submit" class="btn primary grow">${rec ? 'Save' : `Claim +${preview} XP`}</button>
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
