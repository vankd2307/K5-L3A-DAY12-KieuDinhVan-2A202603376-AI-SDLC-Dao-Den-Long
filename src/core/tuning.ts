/**
 * Standard numbers from Ticket-02 (Contract v1.1). game.contract.json `tuning` MUST mirror TUNING
 * (enforced by tests/contract.test.ts). Do not change these without a new ticket.
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
  night2_duration_s: number;
  night3_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
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
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  fall_enabled: true,
  score: {
    per_mote: 10, // per mote DEPOSITED (Ticket-02)
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

export const TICK_RATE = 60;

/** Other standard constants from Ticket-02 Part 1 that are not in the contract tuning block. */
export const STD = {
  jumpSpeed: 7,
  gravity: 20,
  pickupHeight: 1.5,
  moteCap: 30,
  moteInitial: 20,
  moteSpawnEvery: 240,
  droppedTtl: 480,
  dropRingMin: 1.5,
  dropRingMax: 2.5,
  pulseCenterY: 0.8,
  pulsePushTicks: 15,
  evictTicks: 30,
  shadeDetect: 12,
  shadeLose: 18,
  hitHeight: 1.5,
  recoilDist: 2,
  recoilTicks: 60,
  shadeFirstSpawn: 300,
  shadeMinSpawnDist: 15,
  fallY: -10,
  respawnWait: 60,
  charmTicks: 600,
  charmSpeed: 7.2,
  charmRespawn: 2700,
  drifterSpeed: 7,
  drifterIdleSpeed: 2,
  drifterMax: 2,
  drifterSpawnEvery: 1200,
  drifterTriggerCarry: 5,
  drifterDetect: 15,
  drifterHit: 1.2,
  drifterStealMax: 3,
  drifterFleeTicks: 240,
  drifterDropRemoveTicks: 120,
  windEvery: 1800,
  windTicks: 300,
  windSpeed: 2,
  windWarnTicks: 120,
} as const;

/** Values Ticket-02 leaves open (documented in docs/notes/assumptions.md). */
export const OWN = {
  shadeY: 1, // shade centre hovers 1 m above ground
  drifterY: 1.5,
  shadeSpawningTicks: 60,
  shadeWanderSpeed: 1.5,
  wanderRange: 8,
  stepUp: 0.35, // max ledge the player walks up without jumping (ramps are gentler than this per tick)
  snapDown: 0.35,
} as const;
