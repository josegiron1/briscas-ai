import { BriscaGame, type Card, type TrickRecord } from 'brisca-engine';
import { describe, expect, it } from 'vitest';
import { chooseCard } from '../src/bot/chooseCard';
import { toPlayerView, type PlayerView } from '../src/bot/view';

function view(partial: Partial<PlayerView> & Pick<PlayerView, 'hand' | 'trumpSuit'>): PlayerView {
  const trumpCard: Card = partial.trumpCard ?? { suit: partial.trumpSuit, rank: 7 };
  return {
    player: 1,
    playerCount: 2,
    trumpCard,
    currentTrick: [],
    leader: 0,
    scores: [0, 0],
    history: [],
    drawRemaining: 20,
    ...partial,
  };
}

describe('chooseFollow', () => {
  it('takes an ace with the cheapest winner', () => {
    const decision = chooseCard(
      view({
        trumpSuit: 'bastos',
        currentTrick: [{ player: 0, card: { suit: 'oros', rank: 1 } }],
        hand: [
          { suit: 'bastos', rank: 2 },
          { suit: 'bastos', rank: 3 },
          { suit: 'copas', rank: 2 },
        ],
      }),
    );
    expect(decision.card).toEqual({ suit: 'bastos', rank: 2 });
    expect(decision.rule).toBe('follow.take-points');
  });

  it('dumps the cheapest card when it cannot win', () => {
    const decision = chooseCard(
      view({
        trumpSuit: 'bastos',
        currentTrick: [{ player: 0, card: { suit: 'oros', rank: 1 } }],
        hand: [
          { suit: 'copas', rank: 12 },
          { suit: 'copas', rank: 2 },
          { suit: 'espadas', rank: 5 },
        ],
      }),
    );
    expect(decision.card).toEqual({ suit: 'copas', rank: 2 });
    expect(decision.rule).toBe('follow.dump');
  });

  it('does not waste an ace on an empty trick while the 3 is still out', () => {
    const decision = chooseCard(
      view({
        trumpSuit: 'bastos',
        currentTrick: [{ player: 0, card: { suit: 'oros', rank: 2 } }],
        hand: [
          { suit: 'oros', rank: 1 },
          { suit: 'copas', rank: 5 },
          { suit: 'espadas', rank: 4 },
        ],
      }),
    );
    expect(decision.card).toEqual({ suit: 'espadas', rank: 4 });
    expect(decision.rule).toBe('follow.decline-waste');
  });

  it('cashes an ace on an empty trick once the matching 3 is gone', () => {
    const history: TrickRecord[] = [
      {
        plays: [
          { player: 0, card: { suit: 'copas', rank: 3 } },
          { player: 1, card: { suit: 'bastos', rank: 2 } },
        ],
        winner: 1,
        points: 10,
      },
    ];
    const decision = chooseCard(
      view({
        trumpSuit: 'bastos',
        history,
        currentTrick: [{ player: 0, card: { suit: 'copas', rank: 2 } }],
        hand: [
          { suit: 'copas', rank: 1 },
          { suit: 'espadas', rank: 12 },
          { suit: 'oros', rank: 7 },
        ],
      }),
    );
    expect(decision.card).toEqual({ suit: 'copas', rank: 1 });
    expect(decision.rule).toBe('follow.take-empty');
  });

  it('takes a 0-point trick with a cheap non-life card to keep the lead', () => {
    const decision = chooseCard(
      view({
        trumpSuit: 'bastos',
        currentTrick: [{ player: 0, card: { suit: 'oros', rank: 2 } }],
        hand: [
          { suit: 'oros', rank: 4 },
          { suit: 'copas', rank: 1 },
          { suit: 'espadas', rank: 3 },
        ],
      }),
    );
    expect(decision.card).toEqual({ suit: 'oros', rank: 4 });
    expect(decision.rule).toBe('follow.take-empty');
  });
});

describe('chooseLead', () => {
  it('leads the weakest 0-point non-trump', () => {
    const decision = chooseCard(
      view({
        trumpSuit: 'bastos',
        hand: [
          { suit: 'oros', rank: 1 },
          { suit: 'copas', rank: 2 },
          { suit: 'bastos', rank: 4 },
        ],
      }),
    );
    expect(decision.card).toEqual({ suit: 'copas', rank: 2 });
    expect(decision.rule).toBe('lead.low-non-trump');
  });

  it('does not lead trump when a side suit remains', () => {
    const decision = chooseCard(
      view({
        trumpSuit: 'bastos',
        hand: [
          { suit: 'bastos', rank: 2 },
          { suit: 'oros', rank: 12 },
          { suit: 'bastos', rank: 7 },
        ],
      }),
    );
    expect(decision.card).toEqual({ suit: 'oros', rank: 12 });
    expect(decision.rule).toBe('lead.cheap-non-trump');
  });

  it('cashes a sure-winner ace of trump in the endgame', () => {
    const decision = chooseCard(
      view({
        trumpSuit: 'bastos',
        drawRemaining: 0,
        hand: [
          { suit: 'bastos', rank: 1 },
          { suit: 'oros', rank: 2 },
          { suit: 'copas', rank: 4 },
        ],
      }),
    );
    expect(decision.card).toEqual({ suit: 'bastos', rank: 1 });
    expect(decision.rule).toBe('lead.endgame-cash');
  });
});

describe('bot vs random', () => {
  it('beats a random player over a batch of games', () => {
    const games = 80;
    let wins = 0;
    let ties = 0;

    for (let i = 0; i < games; i++) {
      const game = new BriscaGame(2);
      const botSeat = i % 2;
      let guard = 0;

      while (game.getState().phase === 'playing' && guard < 200) {
        const player = game.currentPlayer()!;
        const hand = game.getHand(player);
        const card =
          player === botSeat
            ? chooseCard(toPlayerView(game.getState(), player)).card
            : hand[Math.floor(Math.random() * hand.length)];
        game.playCard(player, card);
        guard += 1;
      }

      const { scores } = game.getState();
      if (scores[botSeat] > scores[1 - botSeat]) wins += 1;
      else if (scores[botSeat] === scores[1 - botSeat]) ties += 1;
    }

    const decided = games - ties;
    expect(decided).toBeGreaterThan(0);
    expect(wins / decided).toBeGreaterThan(0.65);
  });
});
