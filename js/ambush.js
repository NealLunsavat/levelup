// The NASM Ambush encounter: a pop-up during the IT shift with one multiple-choice question.
import { html, useState } from '../vendor/preact-htm.js';
import { AMBUSH_GOLD, AMBUSH_HP_LOSS, AMBUSH_XP } from './rpgMath.js';
import { questionFor } from './nasm.js';
import { put } from './store.js';
import { feedback } from './fx.js';
import { useApp } from './components.js';

const LETTERS = ['A', 'B', 'C', 'D'];

export function Ambush() {
  const { game, data, toast } = useApp();
  const [fight, setFight] = useState(null); // { enc, question, order, choice }
  const enc = game.pendingAmbush;

  if (!fight) {
    if (!enc) return null;
    return html`<div class="ambush-banner" role="alert">
      <span class="ambush-icon">⚔️</span>
      <div class="grow">
        <b>Random Encounter!</b>
        <div class="tiny muted">A NASM question blocks your path. Win +${AMBUSH_XP} INT and +${AMBUSH_GOLD} Gold, or lose ${AMBUSH_HP_LOSS} HP.</div>
      </div>
      <button class="btn small primary" onClick=${() => setFight({ enc, ...questionFor(enc.id, data.ambushes), choice: null })}>Fight</button>
    </div>`;
  }

  const { question, order, choice } = fight;
  const answered = choice != null;

  function answer(i) {
    if (answered) return;
    const correct = i === question.a;
    put({ id: fight.enc.id, type: 'ambush', date: fight.enc.date, questionId: question.id, choice: i, correct, answeredAt: Date.now() });
    setFight({ ...fight, choice: i });
    if (correct) feedback('win', 'double');
    else feedback('hit', 'heavy');
    toast(correct ? `✅ Ambush won! +${AMBUSH_XP} INT · +${AMBUSH_GOLD} Gold` : `💥 Ambush lost · −${AMBUSH_HP_LOSS} HP`);
  }

  return html`<div class="overlay ambush-overlay">
    <div class="sheet ambush-card" role="dialog" aria-modal="true" aria-label="NASM Ambush">
      <div class="ambush-head">
        <span class="ambush-kicker">⚔️ NASM AMBUSH</span>
        ${!answered && html`<button class="link small" onClick=${() => setFight(null)}>Retreat for now</button>`}
      </div>
      <p class="ambush-q">${question.q}</p>
      <div class="ambush-options">
        ${order.map((i, n) => {
          let cls = 'ambush-option';
          if (answered && i === question.a) cls += ' right';
          else if (answered && i === choice) cls += ' wrong';
          return html`<button class=${cls} disabled=${answered} onClick=${() => answer(i)} aria-label=${`${LETTERS[n]}: ${question.o[i]}`}>
            <span class="ambush-letter">${LETTERS[n]}</span><span>${question.o[i]}</span>
          </button>`;
        })}
      </div>
      ${answered && html`<div class=${'ambush-result ' + (choice === question.a ? 'right' : 'wrong')}>
        <b>${choice === question.a ? `Victory! +${AMBUSH_XP} INT · +${AMBUSH_GOLD} Gold` : `Hit! −${AMBUSH_HP_LOSS} HP`}</b>
        <p class="small">${question.why}</p>
        <button class="btn primary" onClick=${() => setFight(null)}>Continue</button>
      </div>`}
    </div>
  </div>`;
}
