import { runHeadless, type InputFrame } from '../src/core';

export interface Line {
  type: string;
  tick?: number;
  name?: string;
  data?: Record<string, unknown>;
  [k: string]: unknown;
}

/** Run the headless pipeline in-process and return parsed output lines. */
export function run(opts: { seed?: number; ticks: number; scenario?: unknown; frames?: InputFrame[]; every?: number }) {
  const lines: Line[] = [];
  runHeadless(
    { seed: opts.seed ?? 1, ticks: opts.ticks, snapshotEvery: opts.every ?? 60, scenario: opts.scenario, frames: opts.frames },
    (o) => lines.push(JSON.parse(JSON.stringify(o)) as Line),
  );
  return {
    lines,
    events: (name?: string) => lines.filter((l) => l.type === 'event' && (!name || l.name === name)),
    snaps: lines.filter((l) => l.type === 'snapshot') as Array<Line & { player: { pos: number[]; flames: number; carried: number } }>,
    end: lines.at(-1) as Line & { ticks: number; state: string; score: number },
  };
}

/** Empty, quiet island: no random motes/shades. */
export const QUIET = { random_motes: false, random_shades: false };
