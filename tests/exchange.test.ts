import { BriscaGame, type Card } from 'brisca-engine';
import { describe, expect, it } from 'vitest';
import { exchangeOffered, exchangeRank, exchangeTrump } from '../src/engine/exchange';
import { shouldExchange } from '../src/bot/chooseCard';
import type { PlayerView } from '../src/bot/view';

function view(partial: Partial<PlayerView> & Pick<PlayerView, 'hand' | 'trumpSuit' | 'trumpCard'>): PlayerView {
  return {
    player: 0,
    playerCount: 2,
    currentTrick: [],
    leader: 0,
    scores: [0, 0],
    history: [],
    drawRemaining: 20,
    ...partial,
  };
}

const won: PlayerView['history'] = [
  {
    plays: [
      { player: 0, card: { suit: 'oros', rank: 2 } },
      { player: 1, card: { suit: 'oros', rank: 4 } },
    ],
    winner: 0,
    points: 0,
  },
];

describe('exchangeRank', () => {
  it('uses the 7 for a point life card and the 2 for a blank', () => {
    expect(exchangeRank({ suit: 'copas', rank: 1 })).toBe(7);
    expect(exchangeRank({ suit: 'copas', rank: 12 })).toBe(7);
    expect(exchangeRank({ suit: 'copas', rank: 10 })).toBe(7);
    expect(exchangeRank({ suit: 'copas', rank: 7 })).toBe(2);
    expect(exchangeRank({ suit: 'copas', rank: 4 })).toBe(2);
  });
});

describe('exchangeOffered', () => {
  it('is illegal before that player has won a trick', () => {
    expect(
      exchangeOffered(
        view({
          trumpSuit: 'copas',
          trumpCard: { suit: 'copas', rank: 1 },
          hand: [
            { suit: 'copas', rank: 7 },
            { suit: 'oros', rank: 2 },
            { suit: 'bastos', rank: 5 },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('offers the 7 for an ace of trump after a win', () => {
    const seven: Card = { suit: 'copas', rank: 7 };
    expect(
      exchangeOffered(
        view({
          trumpSuit: 'copas',
          trumpCard: { suit: 'copas', rank: 1 },
          history: won,
          hand: [seven, { suit: 'oros', rank: 2 }, { suit: 'bastos', rank: 5 }],
        }),
      ),
    ).toEqual(seven);
  });

  it('offers the 2 for a blank life card, not the 7', () => {
    const two: Card = { suit: 'copas', rank: 2 };
    expect(
      exchangeOffered(
        view({
          trumpSuit: 'copas',
          trumpCard: { suit: 'copas', rank: 5 },
          history: won,
          hand: [two, { suit: 'copas', rank: 7 }, { suit: 'bastos', rank: 5 }],
        }),
      ),
    ).toEqual(two);
  });

  it('is illegal once only the life card remains in the stock', () => {
    expect(
      exchangeOffered(
        view({
          trumpSuit: 'copas',
          trumpCard: { suit: 'copas', rank: 1 },
          history: won,
          drawRemaining: 1,
          hand: [{ suit: 'copas', rank: 7 }, { suit: 'oros', rank: 2 }, { suit: 'bastos', rank: 5 }],
        }),
      ),
    ).toBeNull();
  });
});

describe('exchangeTrump', () => {
  it('puts the life card in hand and leaves the 7 face up', () => {
    const game = new BriscaGame(2);
    game.playCard(0, game.getHand(0)[0]);
    game.playCard(1, game.getHand(1)[0]);

    const winner = game.getState().history[0].winner;
    const internals = game as unknown as {
      hands: Card[][];
      trumpCard: Card;
      drawQueue: Card[];
    };
    const suit = internals.trumpCard.suit;
    internals.trumpCard = { suit, rank: 1 };
    internals.drawQueue[internals.drawQueue.length - 1] = internals.trumpCard;
    internals.hands[winner][0] = { suit, rank: 7 };

    const state = exchangeTrump(game, winner);
    expect(state.trumpCard).toEqual({ suit, rank: 7 });
    expect(state.hands[winner].some((card) => card.suit === suit && card.rank === 1)).toBe(true);
    expect(state.drawQueue.at(-1)).toEqual({ suit, rank: 7 });
  });
});

describe('shouldExchange', () => {
  it('takes a point life card whenever the swap is legal', () => {
    const decision = shouldExchange(
      view({
        trumpSuit: 'espadas',
        trumpCard: { suit: 'espadas', rank: 3 },
        history: won,
        hand: [
          { suit: 'espadas', rank: 7 },
          { suit: 'oros', rank: 2 },
          { suit: 'bastos', rank: 5 },
        ],
      }),
    );
    expect(decision?.rule).toBe('exchange.vida');
    expect(decision?.card).toEqual({ suit: 'espadas', rank: 7 });
  });
});
