import './style.css';
import type { Card } from 'brisca-engine';
import { exchangeOffered } from './engine/exchange';
import { formatCard, SUIT_LABEL } from './labels';
import { Session } from './session';
import { renderCard } from './ui/cards';

const scoreboard = el('#scoreboard');
const botHand = el('#bot-hand');
const playerHand = el('#player-hand');
const botReason = el('#bot-reason');
const botChip = el('#bot-chip');
const trump = el('#trump');
const deck = el('#deck');
const trick = el('#trick');
const trickCaption = el('#trick-caption');
const log = el('#log');
const overlay = el('#overlay');
const resultTitle = el('#result-title');
const resultScore = el('#result-score');
const rules = document.querySelector<HTMLDialogElement>('#rules');

let session = new Session();
let locked = false;
let gameId = 0;

el('#new-game').addEventListener('click', () => startGame());
el('#rematch').addEventListener('click', () => startGame());
el('#rules-btn').addEventListener('click', () => rules?.showModal());

playerHand.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button.card.playable');
  if (!button) return;
  const suit = button.dataset.suit as Card['suit'] | undefined;
  const rank = Number(button.dataset.rank) as Card['rank'];
  if (!suit || !rank) return;
  void playHuman({ suit, rank });
});

trump.addEventListener('click', () => {
  if (locked) return;
  if (!exchangeOffered(session.viewFor(session.human))) return;
  if (session.humanExchange()) render();
});

document.addEventListener('keydown', (event) => {
  if (locked || overlay.hidden === false) return;
  const index = Number(event.key) - 1;
  if (index < 0 || index > 2) return;
  if (session.game.currentPlayer() !== session.human) return;
  const card = session.game.getHand(session.human)[index];
  if (card) void playHuman(card);
});

startGame();

function startGame(): void {
  gameId += 1;
  session = new Session();
  locked = false;
  overlay.hidden = true;
  render();
  void maybeBotTurn(gameId);
}

async function playHuman(card: Card): Promise<void> {
  if (locked) return;
  if (session.game.currentPlayer() !== session.human) return;
  if (session.game.getState().phase !== 'playing') return;
  const inHand = session.game
    .getHand(session.human)
    .some((held) => held.suit === card.suit && held.rank === card.rank);
  if (!inHand) return;

  const id = gameId;
  locked = true;
  const resolved = session.play(session.human, card);
  render();
  if (resolved) await pauseResolvedTrick(id);
  if (id !== gameId) return;
  locked = false;
  await maybeBotTurn(id);
}

async function maybeBotTurn(id: number): Promise<void> {
  while (
    id === gameId &&
    session.game.getState().phase === 'playing' &&
    session.game.currentPlayer() === session.bot
  ) {
    locked = true;
    botChip.textContent = 'thinking…';
    await sleep(450);
    if (id !== gameId) return;
    const swapped = session.botExchange();
    if (swapped) {
      session.lastDecision = swapped;
      render();
      await sleep(700);
      if (id !== gameId) return;
    }
    const decision = session.botDecision();
    session.lastDecision = decision;
    const resolved = session.play(session.bot, decision.card);
    render();
    if (resolved) await pauseResolvedTrick(id);
  }

  if (id !== gameId) return;
  locked = false;
  render();
}

async function pauseResolvedTrick(id: number): Promise<void> {
  render();
  await sleep(1100);
  if (id !== gameId) return;
  session.displayTrick = null;
  render();
}

function render(): void {
  const state = session.game.getState();
  const humanTurn = !locked && state.phase === 'playing' && session.game.currentPlayer() === session.human;
  const humanHand = session.game.getHand(session.human);
  const botCards = session.game.getHand(session.bot);

  scoreboard.innerHTML = `
    ${scoreBlock('You', state.scores[session.human], true)}
    ${scoreBlock('Bot', state.scores[session.bot], false)}
  `;

  botHand.innerHTML = botCards.map(() => renderCard(null, { faceDown: true })).join('');
  botChip.textContent =
    state.phase === 'finished'
      ? 'done'
      : session.game.currentPlayer() === session.bot
        ? 'thinking…'
        : 'waiting';
  botReason.textContent = session.lastDecision?.reason ?? 'A decision tree. Not a model.';

  playerHand.innerHTML = humanHand
    .map((card) =>
      renderCard(card, {
        playable: humanTurn,
        label: formatCard(card),
      }),
    )
    .join('');

  const trumpGone = state.drawQueue.length === 0;
  const vida = exchangeOffered(session.viewFor(session.human));
  const canTakeVida = Boolean(vida) && !locked;
  trump.innerHTML = `
    ${renderCard(state.trumpCard, {
      dimmed: trumpGone,
      playable: canTakeVida,
      label: canTakeVida
        ? `Coge la vida con tu ${vida ? formatCard(vida) : ''}`
        : `La vida, ${formatCard(state.trumpCard)}`,
    })}
    <p class="suit-chip">
      ${SUIT_LABEL[state.trumpSuit]}${trumpGone ? ' · already drawn' : canTakeVida ? ' · click to swap' : ''}
    </p>
  `;

  deck.innerHTML =
    state.drawQueue.length === 0
      ? `<p class="suit-chip">Empty</p>`
      : `${renderCard(null, { faceDown: true, stacked: true })}<span class="deck-count">${state.drawQueue.length}</span>`;

  const shown = session.displayTrick?.plays ?? state.currentTrick;
  trick.innerHTML = shown
    .map((play) => {
      const who = play.player === session.human ? 'You' : 'Bot';
      return `<div class="play"><span class="who">${who}</span>${renderCard(play.card, { label: formatCard(play.card) })}</div>`;
    })
    .join('');

  if (session.displayTrick) {
    const youWon = session.displayTrick.winner === session.human;
    trickCaption.textContent = `${youWon ? 'You' : 'Bot'} take${youWon ? '' : 's'} ${session.displayTrick.points} point${session.displayTrick.points === 1 ? '' : 's'}.`;
  } else if (state.phase === 'playing' && shown.length === 0) {
    const leader = state.leader === session.human ? 'You lead.' : 'Bot leads.';
    trickCaption.textContent = leader;
  } else {
    trickCaption.textContent = '';
  }

  log.innerHTML = [...state.history]
    .reverse()
    .map((trickRecord, index) => {
      const number = state.history.length - index;
      const youWon = trickRecord.winner === session.human;
      const cards = trickRecord.plays.map((play) => formatCard(play.card)).join(' · ');
      return `<li class="${youWon ? 'you-won' : ''}">#${number} ${youWon ? 'You' : 'Bot'} +${trickRecord.points} — ${cards}</li>`;
    })
    .join('');

  if (state.phase === 'finished') {
    const you = state.scores[session.human];
    const them = state.scores[session.bot];
    overlay.hidden = false;
    resultTitle.textContent = you > them ? 'You win' : you < them ? 'Bot wins' : 'Split pot';
    resultScore.textContent = `${you} – ${them}`;
  } else {
    overlay.hidden = true;
  }
}

function scoreBlock(label: string, points: number, you: boolean): string {
  return `<div class="score ${you ? 'you' : ''}"><span class="who">${label}</span><span class="pts">${points}</span></div>`;
}

function el(selector: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
