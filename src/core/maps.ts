import { TUNING } from './tuning';
import type { Vec3 } from './types';

/** Angles: from +X, counter-clockwise seen from above => x = r cos a, z = r sin a. */
const polar = (r: number, deg: number, y = 0, cx = 0, cz = 0): Vec3 => {
  const a = (deg * Math.PI) / 180;
  return [round3(cx + r * Math.cos(a)), y, round3(cz + r * Math.sin(a))];
};
const round3 = (v: number) => Math.round(v * 1000) / 1000 + 0;
const ring = (n: number, r: number, start: number, step: number, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => polar(r, start + i * step, y, cx, cz));

export interface Pad {
  pos: Vec3;
  radius: number;
  vy: number;
  /** horizontal launch velocity [vx, vz] */
  hv: [number, number];
}

export interface NightMap {
  night: 1 | 2 | 3;
  name: string;
  durationS: number;
  start: Vec3;
  lanterns: Array<{ id: string; pos: Vec3 }>;
  motePoints: Vec3[];
  shadePoints: Vec3[];
  shadeInterval: number; // ticks between spawns after the first pair
  maxShades: number;
  shadeSpeed: number;
  charms: Vec3[];
  pads: Pad[];
  drifters: boolean;
  wind: boolean;
  /** Walkable height at (x, z); null = sea of clouds (fall). */
  ground(x: number, z: number): number | null;
  /** Solid obstacle (bell tower). */
  solid(x: number, z: number): boolean;
}

const toward = (from: [number, number], to: [number, number], speed: number): [number, number] => {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const l = Math.hypot(dx, dz);
  return [(dx / l) * speed, (dz / l) * speed];
};

const night1: NightMap = {
  night: 1,
  name: 'Đảo Bến',
  durationS: TUNING.night1_duration_s,
  start: [0, 0, 0],
  lanterns: [
    { id: 'L1', pos: [0, 0, 25] },
    { id: 'L2', pos: [23.8, 0, 7.7] },
    { id: 'L3', pos: [14.7, 0, -20.2] },
    { id: 'L4', pos: [-14.7, 0, -20.2] },
    { id: 'L5', pos: [-23.8, 0, 7.7] },
  ],
  motePoints: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)],
  shadePoints: ring(12, 37, 15, 30),
  shadeInterval: 480,
  maxShades: 6,
  shadeSpeed: 4,
  charms: [],
  pads: [],
  drifters: false,
  wind: false,
  ground: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
  solid: () => false,
};

const B: [number, number] = [70, 0];
const night2: NightMap = {
  night: 2,
  name: 'Đảo Cau',
  durationS: TUNING.night2_duration_s,
  start: [0, 0, 0],
  lanterns: [
    { id: 'L1', pos: [0, 0, 20] },
    { id: 'L2', pos: [17, 0, -10] },
    { id: 'L3', pos: [-17, 0, -10] },
    { id: 'L4', pos: [70, 0, 20] },
    { id: 'L5', pos: [87, 0, -10] },
    { id: 'L6', pos: [53, 0, -10] },
  ],
  motePoints: [
    ...ring(4, 10, 0, 90), ...ring(8, 22, 0, 45),
    ...ring(4, 10, 0, 90, 0, B[0], B[1]), ...ring(8, 22, 0, 45, 0, B[0], B[1]),
  ],
  shadePoints: [...ring(8, 26, 22.5, 45), ...ring(8, 26, 22.5, 45, 0, B[0], B[1])],
  shadeInterval: 420,
  maxShades: 8,
  shadeSpeed: 4,
  charms: [[35, 0, 0]],
  pads: [
    { pos: [20, 0, 18], radius: 1, vy: 14, hv: toward([20, 18], B, 24) },
    { pos: [50, 0, -18], radius: 1, vy: 14, hv: toward([50, -18], [0, 0], 24) },
  ],
  drifters: true,
  wind: false,
  ground: (x, z) => {
    if (Math.hypot(x, z) <= 28 || Math.hypot(x - B[0], z - B[1]) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0; // bamboo bridge
    return null;
  },
  solid: () => false,
};

const RAMPS = [30, 150].map((d) => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)] as const);
const night3: NightMap = {
  night: 3,
  name: 'Đảo Chuông',
  durationS: TUNING.night3_duration_s,
  start: [0, 0, -30],
  lanterns: [
    { id: 'L1', pos: [0, 6, 6] },
    { id: 'L2', pos: [18, 3, 10] },
    { id: 'L3', pos: [-18, 3, 10] },
    { id: 'L4', pos: [35, 0, -10] },
    { id: 'L5', pos: [-35, 0, -10] },
    { id: 'L6', pos: [20, 0, -35] },
    { id: 'L7', pos: [-20, 0, -35] },
  ],
  motePoints: [...ring(18, 34, 0, 20), ...ring(8, 18, 20, 20, 3), ...ring(4, 5, 45, 90, 6)],
  shadePoints: ring(16, 43, 0, 22.5),
  shadeInterval: 360,
  maxShades: 10,
  shadeSpeed: 4.5,
  charms: [[30, 0, 25], [-30, 0, 25]],
  pads: [{ pos: [0, 3, 13], radius: 1, vy: 12, hv: [0, -8] }],
  drifters: true,
  wind: true,
  ground: (x, z) => {
    const r = Math.hypot(x, z);
    if (r > 45) return null;
    if (r <= 8) return 6;
    if (z > 0 && r >= 12 && r <= 24) return 3;
    let h = 0;
    for (const [ux, uz] of RAMPS) {
      const t = x * ux + z * uz;
      const lat = Math.abs(-x * uz + z * ux);
      if (lat <= 1.5 && t >= 24 && t <= 30) h = Math.max(h, (3 * (30 - t)) / 6);
    }
    return h;
  },
  solid: (x, z) => Math.hypot(x, z) < 2,
};

export const NIGHTS: Record<1 | 2 | 3, NightMap> = { 1: night1, 2: night2, 3: night3 };
