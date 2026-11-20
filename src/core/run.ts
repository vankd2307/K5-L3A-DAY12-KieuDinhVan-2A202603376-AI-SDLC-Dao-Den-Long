import { Game } from './game';
import { InputTimeline, type InputFrame } from './inputs';
import { applyScenario } from './scenario';

export interface RunOptions {
  seed: number;
  ticks: number;
  snapshotEvery: number;
  scenario?: unknown;
  frames?: InputFrame[];
}

export const DEFAULT_SNAPSHOT_EVERY = 60;

/**
 * Contract E output stream. Snapshots at tick 0 and every `snapshotEvery` ticks, events as they
 * happen, a final snapshot if the last tick was not already one, then the mandatory `end` line.
 */
export function runHeadless(o: RunOptions, emit: (line: object) => void): Game {
  const game = new Game(o.seed);
  if (o.scenario !== undefined) applyScenario(game, o.scenario);
  const inputs = new InputTimeline(o.frames ?? []);

  emit(game.snapshot());
  let lastSnap = 0;
  for (let k = 0; k < o.ticks && game.status === 'playing'; k++) {
    for (const e of game.step(inputs.at(k))) emit({ type: 'event', tick: e.tick, name: e.name, data: e.data });
    if (game.tick % o.snapshotEvery === 0) {
      emit(game.snapshot());
      lastSnap = game.tick;
    }
  }
  if (lastSnap !== game.tick) emit(game.snapshot());
  emit({ type: 'end', ticks: game.tick, state: game.status, score: game.score });
  return game;
}
