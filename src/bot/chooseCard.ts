import { cardPoints, rankStrength, type Card, type Suit } from 'brisca-engine';
import { exchangeOffered } from '../engine/exchange';
import { formatCard } from '../labels';
import { beats, sameCard, trickPoints, winningCard } from './compare';
import { unseenCards, type PlayerView } from './view';

export interface Decision {
  card: Card;
  reason: string;
  rule: string;
}

/** Always take la vida when the swap is legal. It is free EV. */
export function shouldExchange(view: PlayerView): Decision | null {
  const offered = exchangeOffered(view);
  if (!offered) return null;
  return {
    card: offered,
    reason: `Take the life card (${formatCard(view.trumpCard)}) with the ${formatCard(offered)}.`,
    rule: 'exchange.vida',
  };
}

/**
 * Deterministic Brisca player: a decision tree, not a model.
 * It never peeks at hidden hands or the draw queue — only the public view.
 */
export function chooseCard(view: PlayerView): Decision {
  if (view.hand.length === 0) {
    throw new Error('chooseCard called with an empty hand');
  }
  if (view.hand.length === 1) {
    return {
      card: view.hand[0],
      reason: `Only card left: ${formatCard(view.hand[0])}.`,
      rule: 'only-card',
    };
  }

  return view.currentTrick.length === 0 ? chooseLead(view) : chooseFollow(view);
}

function chooseFollow(view: PlayerView): Decision {
  const played = view.currentTrick.map((play) => play.card);
  const leadSuit = played[0].suit;
  const winnerSoFar = winningCard(played, view.trumpSuit);
  const points = trickPoints(played);
  const playersAfter = view.playerCount - view.currentTrick.length - 1;

  const winners = view.hand.filter((card) =>
    beats(card, winnerSoFar, leadSuit, view.trumpSuit),
  );

  if (winners.length > 0) {
    const cheapest = minBy(winners, (card) => sacrificeCost(card, view.trumpSuit));
    const nonWinners = view.hand.filter(
      (card) => !winners.some((winner) => sameCard(winner, card)),
    );
    const take = shouldTake(view, cheapest, points, playersAfter) || nonWinners.length === 0;

    if (take) {
      return {
        card: cheapest,
        reason:
          points > 0
            ? `Take ${points} point${points === 1 ? '' : 's'} with the cheapest winner: ${formatCard(cheapest)}.`
            : `Win an empty trick cheaply with ${formatCard(cheapest)} and keep the lead.`,
        rule: points > 0 ? 'follow.take-points' : 'follow.take-empty',
      };
    }

    const dump = minBy(nonWinners, (card) => sacrificeCost(card, view.trumpSuit));
    const spentTrump = cheapest.suit === view.trumpSuit;
    return {
      card: dump,
      reason: spentTrump && points === 0
        ? `Empty trick — dump ${formatCard(dump)} instead of spending vida.`
        : `Not worth spending ${formatCard(cheapest)} on ${points} point${points === 1 ? '' : 's'} — dump ${formatCard(dump)}.`,
      rule: 'follow.decline-waste',
    };
  }

  const dump = minBy(view.hand, (card) => sacrificeCost(card, view.trumpSuit));
  return {
    card: dump,
    reason: `Cannot beat ${formatCard(winnerSoFar)} — dump ${formatCard(dump)}.`,
    rule: 'follow.dump',
  };
}

function chooseLead(view: PlayerView): Decision {
  if (view.drawRemaining === 0) {
    const sure = view.hand.filter((card) => isSureWinner(card, view));
    if (sure.length > 0) {
      const cash = maxBy(
        sure,
        (card) => cardPoints(card) * 100 + rankStrength(card.rank),
      );
      return {
        card: cash,
        reason: `Endgame — cash a sure winner: ${formatCard(cash)}.`,
        rule: 'lead.endgame-cash',
      };
    }

    const dump = minBy(view.hand, (card) => sacrificeCost(card, view.trumpSuit));
    return {
      card: dump,
      reason: `Endgame — no sure winner, exit cheap with ${formatCard(dump)}.`,
      rule: 'lead.endgame-exit',
    };
  }

  const zeros = view.hand.filter(
    (card) => card.suit !== view.trumpSuit && cardPoints(card) === 0,
  );
  if (zeros.length > 0) {
    const lead = minBy(zeros, (card) => rankStrength(card.rank));
    return {
      card: lead,
      reason: `Lead a low card and keep the life cards: ${formatCard(lead)}.`,
      rule: 'lead.low-non-trump',
    };
  }

  const safe = view.hand.filter(
    (card) => card.suit !== view.trumpSuit && !isPrecious(card, view.trumpSuit),
  );
  if (safe.length > 0) {
    const lead = minBy(safe, (card) => sacrificeCost(card, view.trumpSuit));
    return {
      card: lead,
      reason: `Lead the cheapest non-trump: ${formatCard(lead)}.`,
      rule: 'lead.cheap-non-trump',
    };
  }

  const nonTrump = view.hand.filter((card) => card.suit !== view.trumpSuit);
  if (nonTrump.length > 0) {
    const lead = minBy(nonTrump, (card) => sacrificeCost(card, view.trumpSuit));
    return {
      card: lead,
      reason: `Avoid leading trump — play ${formatCard(lead)}.`,
      rule: 'lead.avoid-trump',
    };
  }

  const dump = minBy(view.hand, (card) => sacrificeCost(card, view.trumpSuit));
  return {
    card: dump,
    reason: `Only trump left — lead the cheapest: ${formatCard(dump)}.`,
    rule: 'lead.cheapest-trump',
  };
}

function shouldTake(
  view: PlayerView,
  cheapest: Card,
  points: number,
  playersAfter: number,
): boolean {
  const precious = isPrecious(cheapest, view.trumpSuit);
  const usingTrump = cheapest.suit === view.trumpSuit;

  if (playersAfter > 0) {
    if (points >= 10) return true;
    if (!usingTrump && !precious && points >= 2) return true;
    return false;
  }

  // Never spend vida on a valueless trick if you can dump a 5, 6, 2, etc.
  if (usingTrump && points === 0) return false;

  if (!precious) return true;
  if (points >= 10) return true;

  if (cheapest.rank === 1) {
    const threeStillOut = unseenCards(view).some(
      (card) => card.suit === cheapest.suit && card.rank === 3,
    );
    return !(threeStillOut && points < 4);
  }

  if (cheapest.rank === 3) return points >= 2;
  return points >= 2;
}

/** Life cards, plus trump face cards — don't spend these on crumbs. */
export function isPrecious(card: Card, trumpSuit: Suit): boolean {
  if (card.rank === 1 || card.rank === 3) return true;
  return card.suit === trumpSuit && cardPoints(card) >= 2;
}

/**
 * Lower = more expendable. Used only to pick *which* card,
 * never to decide whether to fight for the trick.
 */
export function sacrificeCost(card: Card, trumpSuit: Suit): number {
  let cost = cardPoints(card) * 3;
  if (card.suit === trumpSuit) {
    cost += 12;
    if (card.rank === 1) cost += 25;
    else if (card.rank === 3) cost += 18;
  } else if (card.rank === 1) {
    cost += 14;
  } else if (card.rank === 3) {
    cost += 10;
  }
  return cost + rankStrength(card.rank) * 0.3;
}

function isSureWinner(card: Card, view: PlayerView): boolean {
  return unseenCards(view).every(
    (other) => !beats(other, card, card.suit, view.trumpSuit),
  );
}

function minBy<T>(items: T[], key: (item: T) => number): T {
  return items.reduce((best, item) => (key(item) < key(best) ? item : best));
}

function maxBy<T>(items: T[], key: (item: T) => number): T {
  return items.reduce((best, item) => (key(item) > key(best) ? item : best));
}
