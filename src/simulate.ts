import { BriscaGame } from 'brisca-engine';
import { chooseCard, toPlayerView } from './bot';

const GAMES = 400;

function play(botSeat: 0 | 1): { scores: [number, number] } {
  const game = new BriscaGame(2);
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
  return { scores: [scores[0], scores[1]] };
}

let wins = 0;
let losses = 0;
let ties = 0;

for (let i = 0; i < GAMES; i++) {
  const botSeat = (i % 2) as 0 | 1;
  const { scores } = play(botSeat);
  const botScore = scores[botSeat];
  const other = scores[1 - botSeat];
  if (botScore > other) wins += 1;
  else if (botScore < other) losses += 1;
  else ties += 1;
}

const decided = wins + losses;
console.log(`Decision-tree bot vs random — ${GAMES} games (alternating seats)`);
console.log(`  wins   ${wins}  (${((wins / GAMES) * 100).toFixed(1)}%)`);
console.log(`  losses ${losses}  (${((losses / GAMES) * 100).toFixed(1)}%)`);
console.log(`  ties   ${ties}`);
if (decided > 0) {
  console.log(`  win rate excluding ties  ${((wins / decided) * 100).toFixed(1)}%`);
}
