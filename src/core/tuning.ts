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
  fuel_max: number;
  fuel_decay_per_s: number;
  fuel_per_mote: number;
  relight_cost: number;
  win_ratio: number;
  drain_per_s: number;
  low_fuel_threshold: number;
  capacity_max: number;
  score: {
    per_mote: number;
    per_lantern: number;
    per_relight: number;
    per_stun: number;
    per_stun_drain: number;
    per_second_left: number;
    per_flame_left: number;
    per_lantern_at_dawn: number;
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
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
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
  fuel_max: 100,
  fuel_decay_per_s: 1,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
  score: {
    per_mote: 5, // per mote deposited: light, relight or refuel (Ticket-03)
    per_lantern: 100, // first light
    per_relight: 40,
    per_stun: 5,
    per_stun_drain: 15, // total for a shade that was draining
    per_second_left: 0, // time bonus removed by Ticket-03
    per_flame_left: 50,
    per_lantern_at_dawn: 50, // + floor(fuel), only when won
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
  drainBreakDist: 6, // drain -> chase when Mây is within 6 m
  drainReach: 2, // wander -> drain within 2 m of a weak lantern
  capacityPerLight: 2,
} as const;

/** Fuel is stored in integer 1/60 units (Ticket-03 recommends this to avoid float drift). */
export const FUEL_UNIT = 60;

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
