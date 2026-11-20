// Placeholder model — will be replaced to match PRD-0 / Test Contract.
export interface Vec3 { x: number; y: number; z: number }

/** Input for one tick. Engine-agnostic so both keyboard and scenario files can drive it. */
export interface TickInput {
  moveX: number; // -1..1
  moveZ: number; // -1..1
}

export interface GameConfig {
  tickRate: number;    // ticks per second (fixed timestep)
  playerSpeed: number; // units per second
}

export interface GameState {
  tick: number;
  player: { pos: Vec3 };
}
