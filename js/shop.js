// The Loot Shop: turn in-game Gold into permission to buy real things.
import { html, useState } from '../vendor/preact-htm.js';
import { GOLD_PER_IRL_DOLLAR, goldCost } from './rpgMath.js';
import { put, remove } from './store.js';
import { Bar, Card, Empty, Sheet, celebrate, useApp } from './components.js';
import { Choice, Num, Text } from './logsheet.js';
import { fmtMoney, fmtNum } from './util.js';

const CATEGORIES = [
  { id: 'Shoes', icon: '👟' },
  { id: 'Apparel', icon: '👕' },
  { id: 'Car parts', icon: '🚗' },
  { id: 'Tech', icon: '🎧' },
  { id: 'Other', icon: '🎁' },
];
const iconFor = category => CATEGORIES.find(c => c.id === category)?.icon ?? '🎁';

export function Shop() {
  const { data, game } = useApp();
  const [editing, setEditing] = useState(null);
  const [granted, setGranted] = useState(null);
  const locked = game.shopLockedUntil;
  const wishlist = data.loot.filter(i => !i.purchasedAt).sort((a, b) => a.usd - b.usd);
  const owned = data.loot.filter(i => i.purchasedAt).sort((a, b) => b.purchasedAt - a.purchasedAt);

  function buy(item) {
    const cost = goldCost(item.usd);
    if (locked || game.gold < cost) return;
    put({ ...item, purchasedAt: Date.now(), goldCost: cost });
    celebrate();
    setGranted(item);
  }

  function undo(item) {
    if (!confirm(`Undo buying ${item.name}? You'll get ${fmtNum(item.goldCost)} Gold back.`)) return;
    put({ ...item, purchasedAt: null, goldCost: null });
  }

  return html`<div class="page">
    <h1 class="page-title">Loot Shop</h1>
    <div class="shop-wallet">
      <div><div class="wallet-gold">🪙 ${fmtNum(game.gold)}</div><div class="muted small">Gold to spend · ${fmtNum(game.goldEarned)} earned all time</div></div>
      <div class="wallet-rate"><b>${GOLD_PER_IRL_DOLLAR} Gold = $1</b><span class="tiny muted">Earn 1 Gold per $1 driving or paid toward debt</span></div>
    </div>
    ${locked && html`<div class="banner danger">🧠 Cyberpsychosis has locked the shop until ${new Date(locked).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}. Cure it early with an 8-hour sleep or a perfect nutrition day.</div>`}

    <${Card} title="Wishlist" right=${html`<button class="btn small" onClick=${() => setEditing({})}>+ Add item</button>`}>
      ${wishlist.length ? html`<div class="loot-list">${wishlist.map(item => {
        const cost = goldCost(item.usd);
        const affordable = game.gold >= cost;
        return html`<div class=${'loot' + (affordable && !locked ? ' affordable' : '')}>
          <span class="loot-icon">${iconFor(item.category)}</span>
          <div class="loot-main">
            <div class="loot-head">
              <span class="loot-name">${item.name}</span>
              <button class="icon-btn" aria-label=${'Edit ' + item.name} onClick=${() => setEditing(item)}>✎</button>
            </div>
            <div class="small muted">${fmtMoney(item.usd)} IRL · <b class="gold-text">${fmtNum(cost)} Gold</b></div>
            <${Bar} pct=${game.gold / cost} color="var(--gold)" thin />
            <div class="loot-foot">
              <span class="tiny muted">${affordable ? 'You can afford this!' : `${fmtNum(cost - game.gold)} more Gold to go`}</span>
              <button class="btn small primary" disabled=${!affordable || !!locked} onClick=${() => buy(item)}>Purchase</button>
            </div>
          </div>
        </div>`;
      })}</div>` : html`<${Empty}>Add things you want IRL (shoes, apparel, parts for the Prius or Mazda) and earn them with Gold.<//>`}
    <//>

    <${Card} title="🏆 Trophy case">
      ${owned.length ? html`<div class="mini-table">${owned.map(item => html`<div class="mini-row">
        <span>${iconFor(item.category)} ${item.name}</span>
        <span class="muted tiny">${new Date(item.purchasedAt).toLocaleDateString()} · ${fmtNum(item.goldCost)} Gold</span>
        <button class="link small" onClick=${() => undo(item)}>Undo</button>
      </div>`)}</div>` : html`<${Empty}>Your earned loot will show up here.<//>`}
    <//>

    ${editing && html`<${ItemForm} item=${editing} onClose=${() => setEditing(null)} />`}
    ${granted && html`<div class="levelup" onClick=${() => setGranted(null)}>
      <div class="levelup-card granted">
        <div class="levelup-rays"></div>
        <div class="levelup-kicker">PERMISSION GRANTED</div>
        <div class="granted-icon">${iconFor(granted.category)}</div>
        <div class="granted-name">${granted.name}</div>
        <p class="granted-text">You earned it. Go buy it IRL. 🎉</p>
        <button class="btn primary">Hell yeah</button>
      </div>
    </div>`}
  </div>`;
}

function ItemForm({ item, onClose }) {
  const [f, setF] = useState({ name: item.name ?? '', usd: item.usd ?? '', category: item.category ?? 'Apparel' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [error, setError] = useState('');
  function save(e) {
    e.preventDefault();
    if (!f.name.trim() || !(f.usd > 0)) return setError('Add a name and the real-world price.');
    put({ ...item, type: 'loot', name: f.name.trim(), usd: f.usd, category: f.category, createdAt: item.createdAt ?? Date.now() });
    onClose();
  }
  function del() {
    if (!confirm(`Remove ${item.name} from your wishlist?`)) return;
    remove(item.id);
    onClose();
  }
  return html`<${Sheet} title=${item.id ? 'Edit item' : 'Add to wishlist'} onClose=${onClose}>
    <form class="form" onSubmit=${save}>
      <${Text} label="Item" k="name" placeholder="e.g. Nike Metcon 9" f=${f} set=${set} />
      <${Num} label="Real-world price" k="usd" prefix="$" f=${f} set=${set} />
      <${Choice} label="Category" options=${CATEGORIES.map(c => c.id)} value=${f.category} onChange=${v => set('category', v)} />
      <div class="banner subtle">Costs <b>${fmtNum(goldCost(f.usd))} Gold</b></div>
      ${error && html`<p class="error">${error}</p>`}
      <div class="form-actions">
        ${item.id && html`<button type="button" class="btn ghost danger-text" onClick=${del}>Delete</button>`}
        <button class="btn primary grow" type="submit">Save</button>
      </div>
    </form>
  <//>`;
}
