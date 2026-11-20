/**
 * Every gameplay number lives here. game.contract.json `tuning` MUST mirror this object
 * (enforced by tests/contract.test.ts). Rationale for each value: docs/notes/assumptions.md.
 */
export interface Tuning {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  score: {
    per_mote: number;
    per_lantern: number;
    per_stun: number;
    per_second_left: number;
    per_flame_left: number;
  };
}

export const TUNING: Tuning = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.2,
  interact_radius: 2.5,
  pulse_cost: 2,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 2,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 1,
  safe_radius: 5,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 25,
    per_second_left: 1,
    per_flame_left: 50,
  },
};

/** Fixed world constants that are not part of the contract tuning block. */
export const TICK_RATE = 60;
export const ISLAND_RADIUS = 40;
export const LANTERN_RING_RADIUS = 25;
export const SHADE_Y = 1; // shade.pos is its centre, floating 1 m above ground
export const JUMP_SPEED = 6; // m/s
export const GRAVITY = 20; // m/s^2
export const INITIAL_MOTES = 30;
export const MOTE_RESPAWN_S = 2; // one new mote every 2 s while below INITIAL_MOTES
export const INITIAL_SHADES = 2;
export const MAX_SHADES = 5;
export const SHADE_SPAWN_S = 40;
