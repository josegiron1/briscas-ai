import { buildDeck, type Card, type GameState, type PlayedCard, type Suit, type TrickRecord } from 'brisca-engine';
import { cardKey } from './compare';

/** Information a fair player is allowed to see. */
export interface PlayerView {
  player: number;
  playerCount: number;
  hand: Card[];
  trumpCard: Card;
  trumpSuit: Suit;
  currentTrick: PlayedCard[];
  leader: number;
  scores: number[];
  history: TrickRecord[];
  drawRemaining: number;
}

export function toPlayerView(state: GameState, player: number): PlayerView {
  return {
    player,
    playerCount: state.playerCount,
    hand: state.hands[player].slice(),
    trumpCard: state.trumpCard,
    trumpSuit: state.trumpSuit,
    currentTrick: state.currentTrick.slice(),
    leader: state.leader,
    scores: state.scores.slice(),
    history: state.history.slice(),
    drawRemaining: state.drawQueue.length,
  };
}

/**
 * Cards that could still be in an opponent's hand.
 * The face-up trump is public and stays in the deck until the last draw,
 * so it is excluded while the draw pile is not empty.
 */
export function unseenCards(view: PlayerView): Card[] {
  const seen = new Set<string>();
  for (const card of view.hand) seen.add(cardKey(card));
  for (const trick of view.history) {
    for (const play of trick.plays) seen.add(cardKey(play.card));
  }
  for (const play of view.currentTrick) seen.add(cardKey(play.card));
  if (view.drawRemaining > 0) seen.add(cardKey(view.trumpCard));
  return buildDeck().filter((card) => !seen.has(cardKey(card)));
}
