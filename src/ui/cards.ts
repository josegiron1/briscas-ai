import type { Card } from 'brisca-engine';
import { formatCard, RANK_LABEL } from '../labels';

export interface CardRenderOptions {
  playable?: boolean;
  faceDown?: boolean;
  dimmed?: boolean;
  label?: string;
}

export function renderCard(card: Card | null, options: CardRenderOptions = {}): string {
  if (options.faceDown || !card) {
    return `
      <div class="card back ${options.dimmed ? 'dimmed' : ''}" aria-hidden="true">
        <div class="back-inner">
          <span>B</span>
        </div>
      </div>
    `;
  }

  const rank = RANK_LABEL[card.rank];
  const playable = Boolean(options.playable);
  const label = options.label ?? formatCard(card);

  return `
    <button
      type="button"
      class="card face ${playable ? 'playable' : ''} ${options.dimmed ? 'dimmed' : ''}"
      data-suit="${card.suit}"
      data-rank="${card.rank}"
      ${playable ? '' : 'disabled'}
      aria-label="${label}"
    >
      <span class="corner tl">
        <span class="rank">${rank}</span>
        <svg class="mini" viewBox="0 0 32 32"><use href="#suit-${card.suit}"></use></svg>
      </span>
      <span class="face-art">${faceMarkup(card)}</span>
      <span class="corner br">
        <span class="rank">${rank}</span>
        <svg class="mini" viewBox="0 0 32 32"><use href="#suit-${card.suit}"></use></svg>
      </span>
    </button>
  `;
}

function icon(suit: Card['suit']): string {
  return `<svg class="pip" viewBox="0 0 32 32" aria-hidden="true"><use href="#suit-${suit}"></use></svg>`;
}

function faceMarkup(card: Card): string {
  const mark = icon(card.suit);
  if (card.rank === 1 || card.rank === 10 || card.rank === 11 || card.rank === 12) {
    return `<span class="court letter">${card.rank}</span>${mark}`;
  }
  return `<span class="pips n${card.rank}">${mark.repeat(card.rank)}</span>`;
}
