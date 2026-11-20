import { Game } from './game';
import { createRng } from './rng';
import type { Vec3 } from './types';

/** Phase 4 §1 benchmark scene sizes (bench may exceed the gameplay caps). */
export const BENCH = {
  shades: 200,
  motes: 100,
  litLanterns: ['L1', 'L2', 'L3'],
  warmupS: 3,
  cam: { radius: 30, y: 15, periodS: 15 },
} as const;

/**
 * Night 1 benchmark scene (Phase 4 §1): exactly 200 shades in `wander` and 100 motes spread
 * uniformly over the island from `seed`, L1–L3 lit with fuel 100, nothing else spawns,
 * no damage / pickups / fuel decay / end of Night (Game.bench).
 */
export function createBenchGame(seed: number): Game {
  const game = new Game(seed, 1);
  game.bench = true;
  game.randomMotes = false;
  game.randomShades = false;
  game.randomDrifters = false;
  game.windEnabled = false;
  for (const l of game.lanterns) {
    if (!(BENCH.litLanterns as readonly string[]).includes(l.id)) continue;
    l.lit = true;
    l.everLit = true;
    l.fuelUnits = game.fuelMaxUnits;
  }

  const rng = createRng(seed);
  const map = game.map;
  const R = 39; // island radius is 40 m
  /** Uniform point on the island (area-uniform), not inside a lit lantern's safe zone. */
  const spot = (avoidSafe: boolean): Vec3 => {
    for (;;) {
      const a = rng.next() * 2 * Math.PI;
      const r = R * Math.sqrt(rng.next());
      const x = Math.round(r * Math.cos(a) * 1000) / 1000;
      const z = Math.round(r * Math.sin(a) * 1000) / 1000;
      const g = map.ground(x, z);
      if (g === null || map.solid(x, z)) continue;
      if (avoidSafe && game.lanterns.some((l) => game.hasSafeZone(l) && Math.hypot(l.pos[0] - x, l.pos[2] - z) < game.tuning.safe_radius)) continue;
      return [x, g, z];
    }
  };

  game.shadeSerial = 0;
  game.shades = Array.from({ length: BENCH.shades }, () => game.makeShade(spot(true)));
  game.moteSerial = 0;
  game.motes = Array.from({ length: BENCH.motes }, () => game.makeMote(spot(false), 'random'));
  game.motes.forEach((m) => (m.bornSim = -1));
  return game;
}

/** Camera orbit (§1.5): centre (0,0,0), r 30 m, Y 15, starts at (30,15,0), counter-clockwise from above, 15 s per lap. */
export function benchCamera(tS: number): Vec3 {
  const a = (2 * Math.PI * tS) / BENCH.cam.periodS;
  return [BENCH.cam.radius * Math.cos(a), BENCH.cam.y, BENCH.cam.radius * Math.sin(a)];
}

export interface BenchStats {
  frames: number;
  avg_fps: number;
  p1_low_fps: number;
  frame_ms_p95: number;
}

/**
 * Phase 4 §1 formulas over per-frame times dt (ms):
 * avg = 1000·N/Σdt; 1% low = 1000 / mean of the k = max(1, ceil(0.01·N)) largest dt;
 * p95 = 95th percentile of dt (nearest-rank).
 */
export function benchStats(dts: readonly number[]): BenchStats {
  const n = dts.length;
  if (n === 0) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sorted = [...dts].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    frames: n,
    avg_fps: r1((1000 * n) / sum),
    p1_low_fps: r1(1000 / (worst.reduce((s, v) => s + v, 0) / k)),
    frame_ms_p95: r1(sorted[Math.max(0, Math.ceil(0.95 * n) - 1)]!),
  };
}
