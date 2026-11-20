/**
 * Headless runner (Node, no window). Placeholder interface until the Test Contract is known:
 *   npm run headless -- <scenario.json>
 * scenario: { "seed": number, "ticks": number, "inputs"?: { [tick]: TickInput } }
 */
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG, Game, type TickInput } from '../core';

interface Scenario {
  seed: number;
  ticks: number;
  inputs?: Record<string, TickInput>;
}

const IDLE: TickInput = { moveX: 0, moveZ: 0 };

export function runScenario(sc: Scenario): Game {
  const game = new Game(DEFAULT_CONFIG, sc.seed);
  let input = IDLE;
  for (let t = 0; t < sc.ticks; t++) {
    input = sc.inputs?.[String(t)] ?? input; // input holds until changed
    game.step(input);
  }
  return game;
}

const file = process.argv[2];
if (!file) {
  console.error('usage: npm run headless -- <scenario.json>');
  process.exit(2);
}
const game = runScenario(JSON.parse(readFileSync(file, 'utf8')) as Scenario);
process.stdout.write(JSON.stringify(game.state) + '\n');
