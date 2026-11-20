import { Game } from './game';
import { InputTimeline, type InputFrame } from './inputs';
import { applyScenario } from './scenario';

export interface RunOptions {
  seed: number;
  night?: 1 | 2 | 3;
  ticks: number;
  snapshotEvery: number;
  scenario?: unknown;
  frames?: InputFrame[];
}

export const DEFAULT_SNAPSHOT_EVERY = 60;

/**
 * Contract E output stream: tick-0 snapshot, `night_start` (tick 0), events as they happen,
 * snapshots every `snapshotEvery` ticks, a final snapshot if needed, then the mandatory `end`.
 */
export function runHeadless(o: RunOptions, emit: (line: object) => void): Game {
  const game = new Game(o.seed, o.night ?? 1);
  if (o.scenario !== undefined) applyScenario(game, o.scenario);
  const inputs = new InputTimeline(o.frames ?? []);

  emit(game.snapshot());
  emit({ type: 'event', tick: 0, name: 'night_start', data: { night: game.night } });
  let lastSnap = 0;
  for (let k = 0; k < o.ticks && !game.over; k++) {
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
