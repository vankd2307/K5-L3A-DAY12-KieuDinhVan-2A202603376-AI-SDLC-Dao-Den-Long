/** [x, y, z] in metres, Y up. */
export type Vec3 = [number, number, number];

/** Resolved input for one tick (contract C, after defaults / held values). */
export interface FrameInput {
  move: [number, number];
  camYawDeg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export interface Player {
  pos: Vec3; // feet
  vel: Vec3; // last applied velocity (m/s)
  grounded: boolean;
  facing: [number, number]; // unit XZ
  flames: number;
  carried: number;
  invulnTicks: number;
  dashCdTicks: number;
  dashTicks: number;
  dashDir: [number, number];
  pulseCdTicks: number;
  charmTicks: number;
  successfulLights: number;
  /** horizontal velocity from a launch pad, held until landing */
  launch: [number, number] | null;
  /** > 0 while waiting to respawn after falling off */
  respawnTicks: number;
}

export interface Lantern {
  id: string;
  pos: Vec3; // foot of the post
  deposited: number;
  lit: boolean;
  fuelUnits: number; // fuel x 60 (integer)
  everLit: boolean;
  relitCount: number;
}

export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain';

export interface Shade {
  id: string;
  pos: Vec3; // centre
  state: ShadeState;
  stateTicks: number; // spawning / recoil / stunned remaining
  pushTicks: number; // stun push-back remaining
  dir: [number, number]; // push / recoil direction
  evictTicks: number;
  evictStep: [number, number];
  target: [number, number] | null; // wander target
  targetLanternId: string | null; // drain target
  drainTicks: number;
}

export type MoteKind = 'random' | 'dropped';

export interface Mote {
  id: string;
  pos: Vec3; // on the ground
  kind: MoteKind;
  ttl: number; // ticks, dropped only
  bornSim: number; // pickable from the next sim tick
  point: number; // spawn-point index for random motes, -1 otherwise
}

export type DrifterState = 'idle' | 'chase' | 'flee' | 'removed';

export interface Drifter {
  id: string;
  pos: Vec3;
  state: DrifterState;
  stolen: number;
  fleeTicks: number;
  target: [number, number] | null;
}

export interface Charm {
  id: string;
  pos: Vec3;
  available: boolean;
  respawnTicks: number;
}

export type GameStatus = 'playing' | 'paused' | 'won' | 'lost';

export type GameEvent =
  | { name: 'night_start'; data: { night: number } }
  | { name: 'mote_picked'; data: { carried: number } }
  | { name: 'deposit'; data: { lantern_id: string; amount: number; deposited: number } }
  | { name: 'lantern_lit'; data: { lantern_id: string; relight: boolean } }
  | { name: 'refuel'; data: { lantern_id: string; amount: number; fuel: number } }
  | { name: 'lantern_out'; data: { lantern_id: string } }
  | { name: 'fuel_drain'; data: { lantern_id: string; shade_id: string; fuel: number } }
  | { name: 'pulse'; data: { stunned_ids: string[] } }
  | { name: 'player_hit'; data: { by: 'shade'; flames: number; dropped: number } }
  | { name: 'player_hit'; data: { by: 'fall'; flames: number; dropped: number; lost: number } }
  | { name: 'shade_spawned'; data: { id: string } }
  | { name: 'dash'; data: Record<string, never> }
  | { name: 'charm_picked'; data: { charm_id: string; charm_ticks: number } }
  | { name: 'drifter_steal'; data: { drifter_id: string; amount: number; carried: number } }
  | { name: 'drifter_drop'; data: { drifter_id: string; amount: number } }
  | { name: 'paused'; data: Record<string, never> }
  | { name: 'resumed'; data: Record<string, never> }
  | { name: 'game_over'; data: { result: 'won' | 'lost'; reason: 'dawn_survived' | 'dawn' | 'no_flames' } };

export type TimedEvent = GameEvent & { tick: number };
