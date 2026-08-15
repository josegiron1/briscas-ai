import type { Card } from 'brisca-engine';
import { formatCard, RANK_LABEL, SUIT_LABEL } from '../labels';

export interface CardRenderOptions {
  playable?: boolean;
  faceDown?: boolean;
  dimmed?: boolean;
  stacked?: boolean;
  label?: string;
}

export function renderCard(card: Card | null, options: CardRenderOptions = {}): string {
  if (options.faceDown || !card) {
    const back = `
      <div class="card back ${options.dimmed ? 'dimmed' : ''}" aria-hidden="true"></div>
    `;
    if (!options.stacked) return back;
    return `<div class="stack">${back}${back}${back}</div>`;
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
      <span class="inner">
        <span class="corner tl">
          <span class="rank">${rank}</span>
          <svg class="mini" viewBox="0 0 32 32"><use href="#suit-${card.suit}"></use></svg>
        </span>
        <span class="face-art">${faceMarkup(card)}</span>
        <span class="corner br">
          <span class="rank">${rank}</span>
          <svg class="mini" viewBox="0 0 32 32"><use href="#suit-${card.suit}"></use></svg>
        </span>
      </span>
    </button>
  `;
}

function icon(suit: Card['suit'], extra = ''): string {
  return `<svg class="pip ${extra}" viewBox="0 0 32 32" aria-hidden="true"><use href="#suit-${suit}"></use></svg>`;
}

function faceMarkup(card: Card): string {
  if (card.rank === 1 || card.rank === 10 || card.rank === 11 || card.rank === 12) {
    return `
      <span class="court letter">${card.rank}</span>
      ${icon(card.suit, 'hero')}
      <span class="suit-name">${SUIT_LABEL[card.suit]}</span>
    `;
  }
  return `<span class="pips n${card.rank}">${icon(card.suit).repeat(card.rank)}</span>`;
}
