import { Game, IDLE_INPUT } from './game';
import { createRng } from './rng';
import { TICK_RATE } from './tuning';
import type { FrameInput } from './types';

/** Phase 4 §2 random input: new direction every 30 ticks; per tick 5% jump, 3% dash, 2% pulse, 10% interact. */
export const SOAK = { redirectEvery: 30, pJump: 0.05, pDash: 0.03, pPulse: 0.02, pInteract: 0.1 } as const;

/** Night for the i-th soak night (i = 1, 2, ...): 1 → 2 → 3 → 1 ... */
export const soakNight = (i: number): 1 | 2 | 3 => (((i - 1) % 3) + 1) as 1 | 2 | 3;

export function soakInputs(seed: number): (tick: number) => FrameInput {
  // Separate stream from the Game's own rng (xor keeps it seed-determined but different).
  const rng = createRng((seed ^ 0x5eed5eed) >>> 0);
  let move: [number, number] = [0, 0];
  return (tick) => {
    if (tick % SOAK.redirectEvery === 0) {
      const a = rng.next() * 2 * Math.PI;
      move = [Math.round(Math.cos(a) * 1000) / 1000, Math.round(Math.sin(a) * 1000) / 1000];
    }
    return {
      ...IDLE_INPUT,
      move,
      jump: rng.next() < SOAK.pJump,
      dash: rng.next() < SOAK.pDash,
      pulse: rng.next() < SOAK.pPulse,
      interact: rng.next() < SOAK.pInteract,
    };
  };
}

/** Plays a freshly loaded Night with random inputs until it ends or its standard duration runs out. */
export function playSoakNight(game: Game, seed: number): Game {
  const input = soakInputs(seed);
  const limit = Math.round(game.durationS * TICK_RATE);
  for (let k = 0; k < limit && !game.over; k++) game.step(input(k));
  return game;
}
