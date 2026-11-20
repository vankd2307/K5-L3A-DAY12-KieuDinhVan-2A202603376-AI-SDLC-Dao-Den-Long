/** [x, y, z] in metres, Y up. */
export type Vec3 = [number, number, number];

/** Resolved input for one tick (contract section C, after applying defaults / held values). */
export interface FrameInput {
  move: [number, number];
  camYawDeg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
}

export interface Player {
  pos: Vec3; // feet
  vy: number;
  flames: number;
  carried: number;
  invulnTicks: number;
}

export interface Lantern {
  id: string;
  pos: Vec3; // foot of the post
  deposited: number;
  lit: boolean;
}

export type ShadeState = 'chase' | 'stunned';

export interface Shade {
  id: string;
  pos: Vec3; // centre
  state: ShadeState;
  stunTicks: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export type GameEvent =
  | { name: 'mote_picked'; data: { carried: number } }
  | { name: 'deposit'; data: { lantern_id: string; amount: number; deposited: number } }
  | { name: 'lantern_lit'; data: { lantern_id: string } }
  | { name: 'pulse'; data: { stunned_ids: string[] } }
  | { name: 'player_hit'; data: { by: 'shade' | 'fall'; flames: number; dropped: number } }
  | { name: 'shade_spawned'; data: { id: string } }
  | { name: 'game_over'; data: { result: 'won' | 'lost'; reason: 'all_lit' | 'dawn' | 'no_flames' } };

export type TimedEvent = GameEvent & { tick: number };
