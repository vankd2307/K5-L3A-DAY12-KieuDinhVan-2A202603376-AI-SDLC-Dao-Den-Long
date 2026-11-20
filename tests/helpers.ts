import { runHeadless, type InputFrame } from '../src/core';

export interface Line {
  type: string;
  tick?: number;
  name?: string;
  data?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface Snap extends Line {
  sim_tick: number;
  state: string;
  time_left_s: number;
  player: { pos: number[]; vel: number[]; grounded: boolean; invuln: boolean; flames: number; carried: number; dash_cd_s: number; pulse_cd_s: number; charm_s: number };
  lanterns: Array<{ id: string; pos: number[]; lit: boolean; deposited: number }>;
  shades: Array<{ id: string; pos: number[]; state: string }>;
  motes: Array<{ id: string; pos: number[]; kind: string; ttl_s: number | null }>;
  motes_active: number;
  drifters: Array<{ id: string; pos: number[]; state: string; stolen: number }>;
  charms: Array<{ id: string; available: boolean; respawn_s: number }>;
  wind: { active: boolean; dir_deg: number | null };
}

/** Run the headless pipeline in-process and return parsed output lines. */
export function run(opts: { seed?: number; night?: 1 | 2 | 3; ticks: number; scenario?: unknown; frames?: InputFrame[]; every?: number }) {
  const lines: Line[] = [];
  runHeadless(
    { seed: opts.seed ?? 1, night: opts.night ?? 1, ticks: opts.ticks, snapshotEvery: opts.every ?? 60, scenario: opts.scenario, frames: opts.frames },
    (o) => lines.push(JSON.parse(JSON.stringify(o)) as Line),
  );
  const snaps = lines.filter((l) => l.type === 'snapshot') as Snap[];
  return {
    lines,
    events: (name?: string) => lines.filter((l) => l.type === 'event' && (!name || l.name === name)),
    snaps,
    /** snapshot at an exact tick (requires every=1 or a matching multiple) */
    at: (tick: number) => snaps.find((s) => s.tick === tick)!,
    last: snaps.at(-1)!,
    end: lines.at(-1) as Line & { ticks: number; state: string; score: number },
  };
}

/** Empty, quiet world: nothing spawns on its own. */
export const QUIET = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false };
