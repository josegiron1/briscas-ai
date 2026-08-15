import { BriscaGame, type Card, type TrickRecord } from 'brisca-engine';
import { chooseCard, shouldExchange, toPlayerView, type Decision, type PlayerView } from './bot';
import { exchangeTrump } from './engine/exchange';

export class Session {
  game: BriscaGame;
  human: number;
  bot: number;
  lastDecision: Decision | null = null;
  displayTrick: TrickRecord | null = null;

  constructor() {
    this.game = new BriscaGame(2);
    this.human = Math.random() < 0.5 ? 0 : 1;
    this.bot = 1 - this.human;
  }

  viewFor(player: number): PlayerView {
    return toPlayerView(this.game.getState(), player);
  }

  botDecision(): Decision {
    return chooseCard(this.viewFor(this.bot));
  }

  botExchange(): Decision | null {
    const decision = shouldExchange(this.viewFor(this.bot));
    if (!decision) return null;
    exchangeTrump(this.game, this.bot);
    return decision;
  }

  humanExchange(): boolean {
    try {
      exchangeTrump(this.game, this.human);
      return true;
    } catch {
      return false;
    }
  }

  play(player: number, card: Card): boolean {
    const before = this.game.getState().history.length;
    this.game.playCard(player, card);
    const after = this.game.getState();
    if (after.history.length > before) {
      this.displayTrick = after.history[after.history.length - 1];
      return true;
    }
    return false;
  }
}
