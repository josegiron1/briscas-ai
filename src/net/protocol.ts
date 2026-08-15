import type { Card, PlayedCard, Suit } from 'brisca-engine';
import { exchangeOffered } from '../engine/exchange';
import type { Session } from '../session';

export interface TableSnapshot {
  yourSeat: number;
  opponentSeat: number;
  yourHand: Card[];
  opponentHandCount: number;
  trumpCard: Card;
  trumpSuit: Suit;
  drawRemaining: number;
  currentTrick: PlayedCard[];
  displayTrick: { winner: number; plays: PlayedCard[] } | null;
  history: { winner: number; plays: PlayedCard[] }[];
  currentPlayer: number | null;
  phase: 'playing' | 'finished';
  scores: number[];
  canExchange: boolean;
}

export type WireMessage =
  | { type: 'ready' }
  | { type: 'sync'; table: TableSnapshot }
  | { type: 'play'; card: Card }
  | { type: 'exchange' }
  | { type: 'new-game' };

export function buildSnapshot(session: Session, seat: number): TableSnapshot {
  const state = session.game.getState();
  const other = 1 - seat;
  const display = session.displayTrick;
  return {
    yourSeat: seat,
    opponentSeat: other,
    yourHand: session.game.getHand(seat),
    opponentHandCount: session.game.getHand(other).length,
    trumpCard: state.trumpCard,
    trumpSuit: state.trumpSuit,
    drawRemaining: state.drawQueue.length,
    currentTrick: state.currentTrick,
    displayTrick: display ? { winner: display.winner, plays: display.plays } : null,
    history: state.history.map((trick) => ({ winner: trick.winner, plays: trick.plays })),
    currentPlayer: session.game.currentPlayer(),
    phase: state.phase,
    scores: state.scores,
    canExchange: Boolean(exchangeOffered(session.viewFor(seat))),
  };
}
