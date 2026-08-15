import { BriscaError, BriscaGame, cardPoints, type Card, type GameState } from 'brisca-engine';
import type { PlayerView } from '../bot/view';

/** 7 takes a point life card (A, 3, K, Q, J). 2 takes a blank (7, 6, 5, 4). */
export function exchangeRank(trumpCard: Card): 7 | 2 {
  return cardPoints(trumpCard) > 0 ? 7 : 2;
}

/**
 * Card the player would give for la vida, or null if the swap is illegal.
 * Legal after that player has won a trick, while the life card is still
 * under the stock (not on the last remaining card).
 */
export function exchangeOffered(view: PlayerView): Card | null {
  if (view.drawRemaining <= 1) return null;
  if (!view.history.some((trick) => trick.winner === view.player)) return null;
  const rank = exchangeRank(view.trumpCard);
  return view.hand.find((card) => card.suit === view.trumpSuit && card.rank === rank) ?? null;
}

type MutableGame = {
  hands: Card[][];
  trumpCard: Card;
  drawQueue: Card[];
};

export function exchangeTrump(game: BriscaGame, player: number): GameState {
  const state = game.getState();
  const offered = exchangeOffered({
    player,
    playerCount: state.playerCount,
    hand: state.hands[player],
    trumpCard: state.trumpCard,
    trumpSuit: state.trumpSuit,
    currentTrick: state.currentTrick,
    leader: state.leader,
    scores: state.scores,
    history: state.history,
    drawRemaining: state.drawQueue.length,
  });

  if (!offered) {
    throw new BriscaError('CANNOT_EXCHANGE', 'That player cannot take the life card right now.');
  }

  const g = game as unknown as MutableGame;
  const hand = g.hands[player];
  const index = hand.findIndex((card) => card.suit === offered.suit && card.rank === offered.rank);
  const [given] = hand.splice(index, 1);
  const taken = g.trumpCard;
  hand.push(taken);
  g.trumpCard = given;

  const last = g.drawQueue.length - 1;
  if (last >= 0 && g.drawQueue[last].suit === taken.suit && g.drawQueue[last].rank === taken.rank) {
    g.drawQueue[last] = given;
  }

  return game.getState();
}
