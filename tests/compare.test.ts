import { BriscaGame, buildDeck, shuffle, type Card, type Suit } from 'brisca-engine';
import { describe, expect, it } from 'vitest';
import { beats, winningCard } from '../src/bot/compare';

const TRUMPS: Suit[] = ['oros', 'copas', 'espadas', 'bastos'];

describe('winningCard', () => {
  it('matches brisca-engine getTrickWinner on random tricks', () => {
    const game = new BriscaGame(2);

    for (let i = 0; i < 200; i++) {
      const trump = TRUMPS[i % TRUMPS.length];
      const cards = shuffle(buildDeck()).slice(0, 2 + (i % 3)) as Card[];
      expect(winningCard(cards, trump)).toEqual(game.getTrickWinner(cards, trump));
    }
  });

  it('lets trump beat a higher non-trump', () => {
    expect(
      beats({ suit: 'bastos', rank: 2 }, { suit: 'oros', rank: 1 }, 'oros', 'bastos'),
    ).toBe(true);
  });

  it('lets a 3 beat a king of the same suit', () => {
    expect(
      beats({ suit: 'copas', rank: 3 }, { suit: 'copas', rank: 12 }, 'copas', 'oros'),
    ).toBe(true);
  });
});
