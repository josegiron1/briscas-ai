import './style.css';
import type { Card } from 'brisca-engine';
import { exchangeOffered } from './engine/exchange';
import { formatCard, SUIT_LABEL } from './labels';
import { buildSnapshot, type TableSnapshot, type WireMessage } from './net/protocol';
import { hostMesa, joinMesa, mesaFromUrl, randomCode, roomLink, type Hosting, type Mesa } from './net/room';
import { Session } from './session';
import { renderCard } from './ui/cards';

const lobby = el('#lobby');
const lobbyHome = el('#lobby-home');
const lobbyWait = el('#lobby-wait');
const lobbyError = el('#lobby-error');
const lobbyStatus = el('#lobby-status');
const roomCodeEl = el('#room-code');
const app = el('#app');
const scoreboard = el('#scoreboard');
const botHand = el('#bot-hand');
const playerHand = el('#player-hand');
const botReason = el('#bot-reason');
const botChip = el('#bot-chip');
const oppName = el('#opp-name');
const trump = el('#trump');
const deck = el('#deck');
const trick = el('#trick');
const trickCaption = el('#trick-caption');
const log = el('#log');
const overlay = el('#overlay');
const resultTitle = el('#result-title');
const resultScore = el('#result-score');
const rules = document.querySelector<HTMLDialogElement>('#rules');

type Mode = 'solo' | 'host' | 'guest';

let mode: Mode = 'solo';
let session = new Session();
let remoteTable: TableSnapshot | null = null;
let mesa: Mesa | null = null;
let hosting: Hosting | null = null;
let ignoreClose = false;
let joinTicket = 0;
let locked = false;
let gameId = 0;

el('#play-solo').addEventListener('click', () => startSolo());
el('#create-room').addEventListener('click', () => void startHost());
el('#cancel-room').addEventListener('click', () => cancelHost());
el('#copy-link').addEventListener('click', () => void copyLink());
el('#new-game').addEventListener('click', () => requestNewGame());
el('#rematch').addEventListener('click', () => requestNewGame());
el('#leave-table').addEventListener('click', () => leaveTable());
el('#rules-btn').addEventListener('click', () => rules?.showModal());

playerHand.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button.card.playable');
  if (!button) return;
  const suit = button.dataset.suit as Card['suit'] | undefined;
  const rank = Number(button.dataset.rank) as Card['rank'];
  if (!suit || !rank) return;
  void playMine({ suit, rank });
});

trump.addEventListener('click', () => {
  if (locked) return;
  void exchangeMine();
});

document.addEventListener('keydown', (event) => {
  if (locked || overlay.hidden === false || app.hidden) return;
  const index = Number(event.key) - 1;
  if (index < 0 || index > 2) return;
  const table = currentTable();
  if (!table || table.currentPlayer !== table.yourSeat) return;
  const card = table.yourHand[index];
  if (card) void playMine(card);
});

const joining = mesaFromUrl();
if (joining) void startGuest(joining);
else showLobby();

function showLobby(): void {
  mode = 'solo';
  lobby.hidden = false;
  lobbyHome.hidden = false;
  lobbyWait.hidden = true;
  app.hidden = true;
  overlay.hidden = true;
  lobbyError.hidden = true;
}

function showTable(): void {
  lobby.hidden = true;
  app.hidden = false;
}

function startSolo(): void {
  teardownMesa();
  mode = 'solo';
  showTable();
  beginHand();
}

async function startHost(): Promise<void> {
  lobbyError.hidden = true;
  const ticket = ++joinTicket;
  const code = randomCode();
  roomCodeEl.textContent = code;
  lobbyHome.hidden = true;
  lobbyWait.hidden = false;
  lobbyStatus.textContent = 'Esperando al otro…';

  try {
    hosting = await hostMesa(code);
    lobbyStatus.textContent = 'Mesa abierta. Manda el enlace y espera.';
    mesa = await hosting.whenGuest;
  } catch {
    if (ticket !== joinTicket) return;
    showError('No se pudo abrir la mesa. Intenta de nuevo.');
    hosting = null;
    lobbyHome.hidden = false;
    lobbyWait.hidden = true;
    return;
  }

  if (ticket !== joinTicket) {
    mesa?.destroy();
    mesa = null;
    return;
  }

  mode = 'host';
  wireMesa();
  session = new Session();
  showTable();
  beginHand(false);
}

async function startGuest(code: string): Promise<void> {
  const ticket = ++joinTicket;
  lobbyHome.hidden = true;
  lobbyWait.hidden = false;
  roomCodeEl.textContent = code;
  lobbyStatus.textContent = 'Entrando a la mesa…';
  lobbyError.hidden = true;

  try {
    mesa = await joinMesa(code);
  } catch {
    if (ticket !== joinTicket) return;
    showError('No se encontró esa mesa. Pide un enlace nuevo.');
    lobbyHome.hidden = false;
    lobbyWait.hidden = true;
    return;
  }

  if (ticket !== joinTicket) {
    mesa?.destroy();
    mesa = null;
    return;
  }

  mode = 'guest';
  wireMesa();
  mesa.send({ type: 'ready' });
  showTable();
  locked = true;
  render();
}

function cancelHost(): void {
  joinTicket += 1;
  teardownMesa();
  showLobby();
}

function leaveTable(): void {
  joinTicket += 1;
  teardownMesa();
  const url = new URL(window.location.href);
  url.searchParams.delete('mesa');
  window.history.replaceState({}, '', url);
  showLobby();
}

function teardownMesa(): void {
  ignoreClose = true;
  mesa?.destroy();
  hosting?.destroy();
  mesa = null;
  hosting = null;
  remoteTable = null;
  ignoreClose = false;
}

function wireMesa(): void {
  if (!mesa) return;
  mesa.onMessage((message) => {
    void handleWire(message);
  });
  mesa.onClose(() => {
    if (ignoreClose) return;
    showError('Se cortó la mesa.');
    leaveTable();
  });
}

async function handleWire(message: WireMessage): Promise<void> {
  if (message.type === 'sync' && mode === 'guest') {
    remoteTable = message.table;
    locked = false;
    render();
    return;
  }

  if (mode !== 'host') return;

  if (message.type === 'ready') {
    pushSync();
    return;
  }
  if (message.type === 'play') {
    if (session.game.currentPlayer() !== session.bot) return;
    await applyPlay(session.bot, message.card);
    return;
  }
  if (message.type === 'exchange') {
    if (session.exchangeFor(session.bot)) {
      pushSync();
      render();
    }
    return;
  }
  if (message.type === 'new-game') {
    beginHand(false);
  }
}

function requestNewGame(): void {
  if (mode === 'guest') {
    mesa?.send({ type: 'new-game' });
    return;
  }
  beginHand(mode === 'solo');
}

function beginHand(withBot = mode === 'solo'): void {
  gameId += 1;
  const keepSeat = mode === 'host' ? { human: session.human } : undefined;
  session = new Session(keepSeat);
  remoteTable = null;
  locked = false;
  overlay.hidden = true;
  render();
  if (mode === 'host') pushSync();
  if (withBot) void maybeBotTurn(gameId);
}

function currentTable(): TableSnapshot | null {
  if (mode === 'guest') return remoteTable;
  return buildSnapshot(session, session.human);
}

function pushSync(): void {
  if (mode !== 'host' || !mesa) return;
  mesa.send({ type: 'sync', table: buildSnapshot(session, session.bot) });
}

async function playMine(card: Card): Promise<void> {
  const table = currentTable();
  if (!table || locked) return;
  if (table.currentPlayer !== table.yourSeat || table.phase !== 'playing') return;
  if (!table.yourHand.some((held) => held.suit === card.suit && held.rank === card.rank)) return;

  if (mode === 'guest') {
    locked = true;
    mesa?.send({ type: 'play', card });
    render();
    return;
  }

  const id = gameId;
  locked = true;
  await applyPlay(session.human, card);
  if (id !== gameId) return;
  locked = false;
  if (mode === 'solo') await maybeBotTurn(id);
  else render();
}

async function exchangeMine(): Promise<void> {
  if (locked) return;
  if (mode === 'guest') {
    mesa?.send({ type: 'exchange' });
    return;
  }
  if (!exchangeOffered(session.viewFor(session.human))) return;
  if (session.humanExchange()) {
    if (mode === 'host') pushSync();
    render();
  }
}

async function applyPlay(player: number, card: Card): Promise<void> {
  const resolved = session.play(player, card);
  render();
  if (mode === 'host') pushSync();
  if (resolved) {
    await pauseResolvedTrick(gameId);
    if (mode === 'host') pushSync();
  }
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
      render();
      await sleep(700);
      if (id !== gameId) return;
    }
    const decision = session.botDecision();
    session.lastDecision = decision;
    await applyPlay(session.bot, decision.card);
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
  const table = currentTable();
  if (!table) {
    scoreboard.innerHTML = `${scoreBlock('Tú', true)}${scoreBlock(opponentLabel(), false)}`;
    return;
  }

  const humanTurn =
    !locked && table.phase === 'playing' && table.currentPlayer === table.yourSeat;
  const them = opponentLabel();

  scoreboard.innerHTML = `${scoreBlock('Tú', true)}${scoreBlock(them, false)}`;
  oppName.textContent = them;

  botHand.innerHTML = Array.from({ length: table.opponentHandCount }, () =>
    renderCard(null, { faceDown: true }),
  ).join('');
  botChip.textContent =
    table.phase === 'finished'
      ? 'listo'
      : table.currentPlayer === table.opponentSeat
        ? mode === 'solo'
          ? 'thinking…'
          : 'su turno'
        : 'esperando';
  botReason.textContent = '';

  playerHand.innerHTML = table.yourHand
    .map((card) => renderCard(card, { playable: humanTurn, label: formatCard(card) }))
    .join('');

  const trumpGone = table.drawRemaining === 0;
  const canTakeVida = table.canExchange && !locked;
  trump.innerHTML = `
    ${renderCard(table.trumpCard, {
      dimmed: trumpGone,
      playable: canTakeVida,
      label: canTakeVida ? 'Coge la vida' : `La vida, ${formatCard(table.trumpCard)}`,
    })}
    <p class="suit-chip">
      ${SUIT_LABEL[table.trumpSuit]}${trumpGone ? ' · already drawn' : canTakeVida ? ' · click to swap' : ''}
    </p>
  `;

  deck.innerHTML =
    table.drawRemaining === 0
      ? `<p class="suit-chip">Empty</p>`
      : `${renderCard(null, { faceDown: true, stacked: true })}<span class="deck-count">${table.drawRemaining}</span>`;

  const shown = table.displayTrick?.plays ?? table.currentTrick;
  trick.innerHTML = shown
    .map((play) => {
      const who = play.player === table.yourSeat ? 'Tú' : them;
      return `<div class="play"><span class="who">${who}</span>${renderCard(play.card, { label: formatCard(play.card) })}</div>`;
    })
    .join('');

  if (table.displayTrick) {
    const youWon = table.displayTrick.winner === table.yourSeat;
    trickCaption.textContent = youWon ? 'Tú te llevas la baza.' : `${them} se lleva la baza.`;
  } else if (table.phase === 'playing' && shown.length === 0) {
    trickCaption.textContent = table.currentPlayer === table.yourSeat ? 'Sales tú.' : `Sale ${them}.`;
  } else {
    trickCaption.textContent = '';
  }

  log.innerHTML = [...table.history]
    .reverse()
    .map((trickRecord, index) => {
      const number = table.history.length - index;
      const youWon = trickRecord.winner === table.yourSeat;
      const cards = trickRecord.plays.map((play) => formatCard(play.card)).join(' · ');
      return `<li class="${youWon ? 'you-won' : ''}">#${number} ${youWon ? 'Tú' : them} — ${cards}</li>`;
    })
    .join('');

  if (table.phase === 'finished') {
    const you = table.scores[table.yourSeat];
    const themScore = table.scores[table.opponentSeat];
    overlay.hidden = false;
    resultTitle.textContent = you > themScore ? 'Ganaste' : you < themScore ? `Gana ${them}` : 'Empate';
    resultScore.textContent = `${you} – ${themScore}`;
  } else {
    overlay.hidden = true;
  }
}

function opponentLabel(): string {
  return mode === 'solo' ? 'Bot' : 'El otro';
}

function scoreBlock(label: string, you: boolean): string {
  return `<div class="score ${you ? 'you' : ''}"><span class="who">${label}</span></div>`;
}

async function copyLink(): Promise<void> {
  const code = roomCodeEl.textContent;
  if (!code) return;
  const link = roomLink(code);
  try {
    await navigator.clipboard.writeText(link);
    lobbyStatus.textContent = 'Enlace copiado. Mándaselo.';
  } catch {
    lobbyStatus.textContent = link;
  }
}

function showError(message: string): void {
  lobbyError.hidden = false;
  lobbyError.textContent = message;
}

function el(selector: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
