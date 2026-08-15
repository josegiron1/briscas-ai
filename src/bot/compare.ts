import { cardPoints, rankStrength, type Card, type Suit } from 'brisca-engine';

export function cardKey(card: Card): string {
  return `${card.suit}-${card.rank}`;
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Same winner rule as brisca-engine's BriscaGame.getTrickWinner. */
export function winningCard(cards: Card[], trumpSuit: Suit): Card {
  if (cards.length === 0) {
    throw new Error('winningCard requires at least one card');
  }

  return cards.reduce((winner, challenger) =>
    beats(challenger, winner, cards[0].suit, trumpSuit) ? challenger : winner,
  );
}

export function beats(
  challenger: Card,
  winner: Card,
  leadSuit: Suit,
  trumpSuit: Suit,
): boolean {
  const winnerIsTrump = winner.suit === trumpSuit;
  const challengerIsTrump = challenger.suit === trumpSuit;

  if (challengerIsTrump && !winnerIsTrump) return true;
  if (winnerIsTrump && !challengerIsTrump) return false;

  if (challengerIsTrump && winnerIsTrump) {
    return rankStrength(challenger.rank) > rankStrength(winner.rank);
  }

  const winnerFollowsLead = winner.suit === leadSuit;
  const challengerFollowsLead = challenger.suit === leadSuit;

  if (challengerFollowsLead && !winnerFollowsLead) return true;
  if (winnerFollowsLead && !challengerFollowsLead) return false;
  if (!winnerFollowsLead && !challengerFollowsLead) return false;

  return rankStrength(challenger.rank) > rankStrength(winner.rank);
}

export function trickPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + cardPoints(card), 0);
}
