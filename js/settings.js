// Settings: profile, targets, quests, custom skills, sync and backups.
import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { ATTRIBUTES, METRICS } from './game.js';
import { WEEKLY_METRICS } from './weekly.js';
import { BOUNTY_XP } from './rpgMath.js';
import { rewardText } from './boards.js';
import { exportData, importData, put, remove, resetAll } from './store.js';
import { Card, Empty, Sheet, useApp } from './components.js';
import { Choice, Num, Text } from './logsheet.js';
import { DAY_LETTERS, fmtMoney, fmtNum } from './util.js';
import * as sync from './sync.js';
import { feedback, fxPrefs, setFxPref } from './fx.js';
import { THEMES, autoTheme } from './theme.js';
import { DUNGEON, hasFriday, questDays } from './dungeon.js';
import { get as getRecord } from './store.js';
import { todayStr } from './util.js';

const COLORS = ['#f3e600', '#00e5ff', '#ff2e88', '#2bff88', '#b45cff', '#ff6b2c', '#ffb627', '#7dd3fc'];

export function Settings() {
  const { data } = useApp();
  const s = data.settings;
  const update = (k, v) => put({ ...s, [k]: v });
  return html`<div class="page">
    <h1 class="page-title">Settings</h1>

    <${Card} title="Profile & targets">
      <div class="form">
        <label class="field"><span>Player name</span><input type="text" value=${s.name} onChange=${e => update('name', e.target.value.trim())} /></label>
        <div class="row">
          <label class="field"><span>Daily calories</span><input type="number" inputmode="numeric" value=${s.calorieTarget} onChange=${e => update('calorieTarget', Number(e.target.value) || 0)} /></label>
          <label class="field"><span>Daily protein (g)</span><input type="number" inputmode="numeric" value=${s.proteinTarget} onChange=${e => update('proteinTarget', Number(e.target.value) || 0)} /></label>
        </div>
        <label class="field"><span>NASM exam date</span><input type="date" value=${s.examDate} onChange=${e => update('examDate', e.target.value)} /></label>
      </div>
    <//>

    <${DeviceCard} />
    <${ScheduleEditor} />
    <${Quests} />
    <${WeeklyEditor} />
    <${BountyEditor} />
    <${CustomSkills} />
    <${SyncCard} />
    <${Backup} />
  </div>`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const daysLabel = days => {
  const d = days.filter(x => x !== 5);
  return d.every((x, i) => i === 0 || x === d[i - 1] + 1) ? `${DAY_NAMES[d[0]]}–${DAY_NAMES[d.at(-1)]}` : d.map(x => DAY_NAMES[x]).join(', ');
};

// Your own Daily Dungeon times. Saved as a new version starting today, so past days keep their old times.
function ScheduleEditor() {
  const { game, toast } = useApp();
  const versions = getRecord('schedule')?.versions ?? [];
  const current = [...versions].sort((a, b) => b.from.localeCompare(a.from)).find(v => v.from <= game.today)?.windows ?? {};
  const initial = () => Object.fromEntries(DUNGEON.map(q => {
    const weekday = current[q.id]?.window ?? q.window;
    return [q.id, { window: [...weekday], friday: [...(current[q.id]?.friday ?? q.friday ?? weekday)] }];
  }));
  const [w, setW] = useState(initial);
  const [error, setError] = useState('');
  const set = (id, which, i, value) => setW(p => ({ ...p, [id]: { ...p[id], [which]: p[id][which].map((x, j) => (j === i ? value : x)) } }));
  const dirty = JSON.stringify(w) !== JSON.stringify(initial());

  function save() {
    for (const q of DUNGEON) {
      for (const which of hasFriday(q) ? ['window', 'friday'] : ['window']) {
        const [s, e] = w[q.id][which];
        if (!s || !e || e <= s) return setError(`${q.name}: the end time has to be after the start time (windows can't cross midnight).`);
      }
    }
    setError('');
    const today = todayStr();
    put({ id: 'schedule', type: 'schedule', versions: [...versions.filter(v => v.from < today), { from: today, windows: w }] });
    feedback('tick');
    toast('🕒 Schedule saved. It applies from today.');
  }
  function reset() {
    setW(Object.fromEntries(DUNGEON.map(q => [q.id, { window: [...q.window], friday: [...(q.friday ?? q.window)] }])));
  }

  const range = (q, which) => html`<div class="sched-range">
    <input type="time" aria-label=${`${q.name} start`} value=${w[q.id][which][0]} onInput=${e => set(q.id, which, 0, e.target.value)} />
    <span class="muted">to</span>
    <input type="time" aria-label=${`${q.name} end`} value=${w[q.id][which][1]} onInput=${e => set(q.id, which, 1, e.target.value)} />
  </div>`;

  return html`<${Card} title="Daily Dungeon times">
    <p class="muted small">Move your quest windows to fit your week. Changes start today; days that already happened keep the times they had.</p>
    <div class="sched">
      ${DUNGEON.map(q => html`<div class="sched-row">
        <div class="sched-name">${q.icon} ${q.name}</div>
        <div class="sched-line"><span class="sched-days">${daysLabel(questDays(q))}</span>${range(q, 'window')}</div>
        ${hasFriday(q) && html`<div class="sched-line"><span class="sched-days">Fri</span>${range(q, 'friday')}</div>`}
      </div>`)}
    </div>
    ${error && html`<p class="error">${error}</p>`}
    <div class="form-actions">
      <button class="btn ghost small" onClick=${reset}>Restore defaults</button>
      <button class="btn primary grow" disabled=${!dirty} onClick=${save}>Save schedule</button>
    </div>
  <//>`;
}

// Look and feel for this device only (not synced).
function DeviceCard() {
  const { themePref, setThemePref } = useApp();
  const [prefs, setPrefs] = useState(fxPrefs());
  const toggle = key => {
    setFxPref(key, !prefs[key]);
    setPrefs(fxPrefs());
    if (!prefs[key]) feedback(key === 'sound' ? 'quest' : 'tick', 'double');
  };
  const options = [['auto', `🕒 Auto (now: ${THEMES[autoTheme()].name})`], ...Object.entries(THEMES).map(([id, t]) => [id, `${t.icon} ${t.name}`])];
  return html`<${Card} title="This device">
    <div class="field"><span>Theme</span>
      <div class="chip-row">
        ${options.map(([id, label]) => html`<button type="button" class=${'chip-btn' + (themePref === id ? ' on' : '')} onClick=${() => setThemePref(id)}>${label}</button>`)}
      </div>
    </div>
    <p class="muted small">Auto follows your day: Iron Dungeon red from 4:00 AM, Neon from 9:00 AM, and Night City from 5:00 PM.</p>
    <button type="button" class=${'toggle' + (prefs.sound ? ' on' : '')} onClick=${() => toggle('sound')} aria-pressed=${prefs.sound}>
      <span class="toggle-dot"></span>
      <span><b>🔊 Sound effects</b><br /><span class="tiny muted">Retro blips for logs, quests and level-ups. They follow your iPhone's silent switch and won't pause your music.</span></span>
    </button>
    <button type="button" class=${'toggle' + (prefs.haptics ? ' on' : '')} onClick=${() => toggle('haptics')} aria-pressed=${prefs.haptics}>
      <span class="toggle-dot"></span>
      <span><b>📳 Haptics</b><br /><span class="tiny muted">A tap you can feel when you log something (iPhone with iOS 18 or later).</span></span>
    </button>
  <//>`;
}

function Quests() {
  const { data, skillMap } = useApp();
  const [editing, setEditing] = useState(null);
  const fmt = q => {
    if (q.metric === 'earned' || q.metric === 'paid') return `${fmtMoney(q.target)} ${q.metric}`;
    if (q.metric === 'count') return q.target === 1 ? '1 entry' : `${fmtNum(q.target)} entries`;
    return `${fmtNum(q.target)} ${METRICS[q.metric]?.label}`;
  };
  return html`<${Card} title="Daily quests" right=${html`<button class="btn small" onClick=${() => setEditing({})}>+ Add</button>`}>
    <p class="muted small">Flexible daily goals you can do any time (the Daily Dungeon is the time-gated schedule). Clear every daily quest scheduled for the day to keep your streak; days with none scheduled are rest days.</p>
    ${data.quests.length ? html`<div class="mini-table">${data.quests.map(q => html`<button class="mini-row quest-setting clickable" onClick=${() => setEditing(q)}>
      <span>${skillMap[q.skill]?.icon ?? '•'} ${q.title}</span>
      <span class="days">${DAY_LETTERS.map((d, i) => html`<i class=${(q.days ?? []).includes(i) ? 'on' : ''}>${d}</i>`)}</span>
      <span class="muted tiny">Target: ${fmt(q)}</span>
    </button>`)}</div>` : html`<${Empty}>No quests yet.<//>`}
  <//>
  ${editing && html`<${QuestForm} quest=${editing} onClose=${() => setEditing(null)} />`}`;
}

const AttrSelect = ({ label, value, onChange, none }) => html`<label class="field"><span>${label}</span>
  <select value=${value} onChange=${e => onChange(e.target.value)}>
    ${none && html`<option value="">None</option>`}
    ${ATTRIBUTES.map(a => html`<option value=${a.id}>${a.icon} ${a.name} (${a.full})</option>`)}
  </select>
</label>`;

// Weekly quests: Monday to Sunday goals, shown under Daily quests on Home.
function WeeklyEditor() {
  const { data } = useApp();
  const [editing, setEditing] = useState(null);
  const tracking = q => {
    const metric = WEEKLY_METRICS[q.track];
    if (!metric) return q.target > 1 ? `Tap ${fmtNum(q.target)} times` : 'Tap when done';
    return `Tracks itself · target ${metric.money ? fmtMoney(q.target) : fmtNum(q.target)} · ${metric.label}`;
  };
  return html`<${Card} title="Weekly quests" right=${html`<button class="btn small" onClick=${() => setEditing({})}>+ Add</button>`}>
    <p class="muted small">Bigger goals that reset every Monday. A quest can count your taps, or track itself from what you log. Claimed rewards are yours to keep even if you change the quest later.</p>
    ${data.weekly.length ? html`<div class="mini-table">${data.weekly.map(q => html`<button class="mini-row quest-setting clickable" onClick=${() => setEditing(q)}>
      <span>${q.title}</span>
      <span class="xp">${rewardText(q.rewards)}</span>
      <span class="muted tiny">${tracking(q)}</span>
    </button>`)}</div>` : html`<${Empty}>No weekly quests yet.<//>`}
  <//>
  ${editing && html`<${WeeklyForm} quest=${editing} onClose=${() => setEditing(null)} />`}`;
}

function WeeklyForm({ quest, onClose }) {
  const { data } = useApp();
  const [f, setF] = useState({
    title: quest.title ?? '', note: quest.note ?? '', track: quest.track ?? 'manual', target: quest.target ?? 1,
    attr1: quest.rewards?.[0]?.attr ?? 'str', xp1: quest.rewards?.[0]?.xp ?? 100,
    attr2: quest.rewards?.[1]?.attr ?? '', xp2: quest.rewards?.[1]?.xp ?? 50,
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [error, setError] = useState('');
  function save(e) {
    e.preventDefault();
    if (!f.title.trim() || !(f.target > 0) || !(f.xp1 > 0)) return setError('Add a name, a target above 0 and a reward.');
    const rewards = [{ attr: f.attr1, xp: f.xp1 }];
    if (f.attr2 && f.xp2 > 0) rewards.push({ attr: f.attr2, xp: f.xp2 });
    const order = quest.order ?? Math.max(0, ...data.weekly.map(q => q.order ?? 0)) + 1;
    put({ ...quest, type: 'weekly', order, title: f.title.trim(), note: f.note.trim(), track: f.track, target: f.target, rewards });
    onClose();
  }
  function del() {
    if (!confirm(`Delete "${quest.title}"? Rewards you already claimed stay.`)) return;
    remove(quest.id);
    onClose();
  }
  const props = { f, set };
  return html`<${Sheet} title=${quest.id ? 'Edit weekly quest' : 'New weekly quest'} onClose=${onClose}>
    <form class="form" onSubmit=${save}>
      <${Text} label="Quest" k="title" placeholder="e.g. The 5-Day Gauntlet" ...${props} />
      <${Text} label="Details (optional)" k="note" placeholder="What counts as done?" ...${props} />
      <label class="field"><span>How it's tracked</span>
        <select value=${f.track} onChange=${e => set('track', e.target.value)}>
          <option value="manual">I'll tap it myself</option>
          ${Object.entries(WEEKLY_METRICS).map(([id, m]) => html`<option value=${id}>Automatic: ${m.label}</option>`)}
        </select>
      </label>
      <${Num} label=${f.track === 'manual' ? 'Times to do it this week (1 = a single checkbox)' : 'Target for the week'} k="target" ...${props} />
      <div class="row">
        <${AttrSelect} label="Reward" value=${f.attr1} onChange=${v => set('attr1', v)} />
        <${Num} label="XP" k="xp1" places=${0} ...${props} />
      </div>
      <div class="row">
        <${AttrSelect} label="Second reward (optional)" value=${f.attr2} onChange=${v => set('attr2', v)} none />
        <${Num} label="XP" k="xp2" places=${0} ...${props} />
      </div>
      ${error && html`<p class="error">${error}</p>`}
      <div class="form-actions">
        ${quest.id && html`<button type="button" class="btn ghost danger-text" onClick=${del}>Delete</button>`}
        <button class="btn primary grow" type="submit">Save</button>
      </div>
    </form>
  <//>`;
}

// Micro-bounties: the small tasks on the Bounty Board during your IT shift.
function BountyEditor() {
  const { data } = useApp();
  const [editing, setEditing] = useState(null);
  const attr = id => ATTRIBUTES.find(a => a.id === id);
  return html`<${Card} title="Micro-bounties" right=${html`<button class="btn small" onClick=${() => setEditing({})}>+ Add</button>`}>
    <p class="muted small">Small, specific tasks for IT downtime. The Bounty Board only appears on Home during your IT shift, and each bounty can be claimed once per shift.</p>
    ${data.bounties.length ? html`<div class="mini-table">${data.bounties.map(b => html`<button class="mini-row clickable" onClick=${() => setEditing(b)}>
      <span>${attr(b.attr)?.icon ?? '🎯'} ${b.title}</span>
      <span></span>
      <span class="xp">+${b.xp ?? BOUNTY_XP} ${attr(b.attr)?.name ?? ''}</span>
    </button>`)}</div>` : html`<${Empty}>No bounties yet.<//>`}
  <//>
  ${editing && html`<${BountyForm} bounty=${editing} onClose=${() => setEditing(null)} />`}`;
}

function BountyForm({ bounty, onClose }) {
  const { data } = useApp();
  const [f, setF] = useState({ title: bounty.title ?? '', attr: bounty.attr ?? 'int', xp: bounty.xp ?? BOUNTY_XP });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [error, setError] = useState('');
  function save(e) {
    e.preventDefault();
    if (!f.title.trim() || !(f.xp > 0)) return setError('Add the task and its XP.');
    const order = bounty.order ?? Math.max(0, ...data.bounties.map(b => b.order ?? 0)) + 1;
    put({ ...bounty, type: 'bounty', order, title: f.title.trim(), attr: f.attr, xp: f.xp });
    onClose();
  }
  function del() {
    if (!confirm(`Delete "${bounty.title}"?`)) return;
    remove(bounty.id);
    onClose();
  }
  return html`<${Sheet} title=${bounty.id ? 'Edit bounty' : 'New bounty'} onClose=${onClose}>
    <form class="form" onSubmit=${save}>
      <${Text} label="Micro-task" k="title" placeholder="e.g. Read 5 pages of the NASM text" f=${f} set=${set} />
      <div class="row">
        <${AttrSelect} label="Reward" value=${f.attr} onChange=${v => set('attr', v)} />
        <${Num} label="XP" k="xp" places=${0} f=${f} set=${set} />
      </div>
      ${error && html`<p class="error">${error}</p>`}
      <div class="form-actions">
        ${bounty.id && html`<button type="button" class="btn ghost danger-text" onClick=${del}>Delete</button>`}
        <button class="btn primary grow" type="submit">Save</button>
      </div>
    </form>
  <//>`;
}

function QuestForm({ quest, onClose }) {
  const { skills, data } = useApp();
  const [f, setF] = useState({ title: quest.title ?? '', skill: quest.skill ?? skills[0].id, metric: quest.metric ?? 'minutes', target: quest.target ?? '', days: quest.days ?? [0, 1, 2, 3, 4, 5, 6] });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [error, setError] = useState('');
  function save(e) {
    e.preventDefault();
    if (!f.title.trim() || !(f.target > 0)) return setError('Give the quest a name and a target above 0.');
    const order = quest.order ?? Math.max(0, ...data.quests.map(q => q.order ?? 0)) + 1;
    put({ ...quest, type: 'quest', order, ...f, title: f.title.trim() });
    onClose();
  }
  function del() {
    if (!confirm(`Delete "${quest.title}"?`)) return;
    remove(quest.id);
    onClose();
  }
  return html`<${Sheet} title=${quest.id ? 'Edit quest' : 'New quest'} onClose=${onClose}>
    <form class="form" onSubmit=${save}>
      <${Text} label="Quest" k="title" placeholder="e.g. Study NASM for 30 min" f=${f} set=${set} />
      <label class="field"><span>Skill</span>
        <select value=${f.skill} onChange=${e => set('skill', e.target.value)}>
          ${skills.map(s => html`<option value=${s.id}>${s.icon} ${s.name}</option>`)}
        </select>
      </label>
      <div class="row">
        <label class="field"><span>Measure</span>
          <select value=${f.metric} onChange=${e => set('metric', e.target.value)}>
            ${Object.entries(METRICS).map(([k, m]) => html`<option value=${k}>${m.label}</option>`)}
          </select>
        </label>
        <${Num} label="Target" k="target" f=${f} set=${set} />
      </div>
      <div class="field"><span>Days</span>
        <div class="chip-row">${DAY_LETTERS.map((d, i) => html`<button type="button" class=${'chip-btn day' + (f.days.includes(i) ? ' on' : '')}
          onClick=${() => set('days', f.days.includes(i) ? f.days.filter(x => x !== i) : [...f.days, i].sort())}>${d}</button>`)}</div>
      </div>
      ${error && html`<p class="error">${error}</p>`}
      <div class="form-actions">
        ${quest.id && html`<button type="button" class="btn ghost danger-text" onClick=${del}>Delete</button>`}
        <button class="btn primary grow" type="submit">Save</button>
      </div>
    </form>
  <//>`;
}

function CustomSkills() {
  const { data } = useApp();
  const [f, setF] = useState({ name: '', icon: '', color: COLORS[0] });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  function add(e) {
    e.preventDefault();
    if (!f.name.trim()) return;
    put({ type: 'skill', name: f.name.trim(), icon: f.icon.trim() || '⭐', color: f.color });
    setF({ name: '', icon: '', color: COLORS[(data.customSkills.length + 1) % COLORS.length] });
  }
  return html`<${Card} title="Custom skills">
    <p class="muted small">Add anything else you want to level up: reading, meditation, a language. Log it by minutes.</p>
    ${data.customSkills.length > 0 && html`<div class="mini-table">${data.customSkills.map(s => html`<div class="mini-row">
      <span><span class="dot" style=${{ background: s.color }}></span>${s.icon} ${s.name}</span>
      <span></span>
      <button class="btn small ghost danger-text" onClick=${() => confirm(`Remove ${s.name}? Its logs stay in your history.`) && remove(s.id)}>Remove</button>
    </div>`)}</div>`}
    <form class="form" onSubmit=${add}>
      <div class="row">
        <label class="field narrow"><span>Emoji</span><input type="text" placeholder="⭐" value=${f.icon} onInput=${e => set('icon', e.target.value)} /></label>
        <${Text} label="Skill name" k="name" placeholder="e.g. Reading" f=${f} set=${set} />
      </div>
      <div class="field"><span>Color</span><div class="chip-row">${COLORS.map(c => html`<button type="button" aria-label=${'Color ' + c}
        class=${'swatch' + (f.color === c ? ' on' : '')} style=${{ background: c }} onClick=${() => set('color', c)}></button>`)}</div></div>
      <button class="btn primary" type="submit">Add skill</button>
    </form>
  <//>`;
}

function SyncCard() {
  const { toast } = useApp();
  const [st, setSt] = useState({ ...sync.syncState() });
  useEffect(() => sync.onSyncChange(() => setSt({ ...sync.syncState() })), []);
  const cfg = sync.getConfig();
  const [f, setF] = useState({ url: cfg.url ?? '', key: cfg.key ?? '', email: '', password: '' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = fn => async e => {
    e?.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await fn();
    } catch (err) {
      setMsg(err.message || String(err));
    }
    setBusy(false);
  };

  let body;
  if (st.status === 'off') {
    body = html`<form class="form" onSubmit=${run(async () => {
      if (!f.url.startsWith('https://') || !f.key) throw new Error('Paste both the Project URL and the API key from Supabase.');
      await sync.connect(f.url, f.key);
    })}>
      <p class="muted small">Right now your data lives only on this device. To keep your iPhone, iPad and Mac in sync, connect a free Supabase project. The README walks you through it in about 5 minutes.</p>
      <${Text} label="Supabase Project URL" k="url" placeholder="https://xxxx.supabase.co" f=${f} set=${set} />
      <${Text} label="Supabase anon / publishable key" k="key" placeholder="eyJhbGci… or sb_publishable_…" f=${f} set=${set} />
      <button class="btn primary" disabled=${busy}>Connect</button>
    </form>`;
  } else if (st.status === 'signed-out' || (!st.user && st.status === 'error')) {
    body = html`<form class="form" onSubmit=${run(() => sync.signIn(f.email, f.password))}>
      <p class="muted small">Sign in with the same email on every device. First time? Create your account here once.</p>
      <label class="field"><span>Email</span><input type="email" autocomplete="username" value=${f.email} onInput=${e => set('email', e.target.value)} /></label>
      <label class="field"><span>Password</span><input type="password" autocomplete="current-password" value=${f.password} onInput=${e => set('password', e.target.value)} /></label>
      <div class="form-actions">
        <button type="button" class="btn ghost" disabled=${busy} onClick=${run(async () => {
          const result = await sync.signUp(f.email, f.password);
          if (result === 'confirm-email') setMsg('Check your email to confirm your account, then sign in here.');
        })}>Create account</button>
        <button class="btn primary grow" disabled=${busy}>Sign in</button>
      </div>
      <button type="button" class="link small" onClick=${() => sync.disconnect()}>Use a different Supabase project</button>
    </form>`;
  } else {
    const label = { syncing: 'Syncing…', ok: 'Synced', error: 'Sync error' }[st.status];
    body = html`<div class="form">
      <div class="sync-status"><span class=${'sync-dot ' + st.status}></span><b>${label}</b>
        <span class="muted small">${st.user?.email}${st.lastSync ? ` · last synced ${new Date(st.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</span></div>
      ${st.error && html`<p class="error">${st.error}</p>`}
      ${st.report && html`<p class="muted small">Last sync: found <b>${st.report.pulled}</b> records in the cloud (${st.report.fresh} new to this device) and sent ${st.report.sent} from this device.</p>`}
      <div class="form-actions">
        <button class="btn ghost" onClick=${run(() => sync.signOut())}>Sign out</button>
        <button class="btn primary grow" disabled=${busy || st.status === 'syncing'} onClick=${run(async () => { await sync.syncNow(); toast('Synced'); })}>Sync now</button>
      </div>
    </div>`;
  }
  return html`<${Card} title="Sync across devices">
    ${body}
    ${msg && html`<p class="error">${msg}</p>`}
  <//>`;
}

function Backup() {
  const { toast } = useApp();
  function download() {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `levelup-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function upload(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const n = importData(JSON.parse(await file.text()));
      toast(`Imported ${n} entries`);
    } catch (err) {
      alert(err.message);
    }
  }
  return html`<${Card} title="Backup">
    <p class="muted small">Download a copy of everything, or restore from one. Handy before switching devices.</p>
    <div class="form-actions">
      <button class="btn" onClick=${download}>Export backup</button>
      <label class="btn">Import backup<input type="file" accept="application/json,.json" hidden onChange=${upload} /></label>
    </div>
    <div class="danger-zone">
      <button class="btn ghost danger-text small" onClick=${() => confirm('Erase ALL your progress and start over? This also erases it on your synced devices. Export a backup first if you might want it back.') && resetAll()}>Reset all progress</button>
    </div>
  <//>`;
}
