import type { Card, Rank, Suit } from 'brisca-engine';

export const SUIT_LABEL: Record<Suit, string> = {
  oros: 'oro',
  copas: 'copa',
  espadas: 'espada',
  bastos: 'basto',
};

export const RANK_LABEL: Record<Rank, string> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  10: '10',
  11: '11',
  12: '12',
};

export function formatCard(card: Card): string {
  return `${card.rank} de ${SUIT_LABEL[card.suit]}`;
}
