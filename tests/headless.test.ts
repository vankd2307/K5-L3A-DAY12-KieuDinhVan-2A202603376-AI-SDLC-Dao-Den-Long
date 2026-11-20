import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const run = () =>
  execFileSync(process.execPath, ['--import', 'tsx', 'src/headless/cli.ts', 'scenarios/smoke.json'], {
    encoding: 'utf8',
  });

describe('headless cli', () => {
  it('is deterministic: same scenario twice -> identical output', () => {
    const a = run();
    const b = run();
    expect(a).toBe(b);
    const state = JSON.parse(a);
    expect(state.tick).toBe(120);
    expect(state.player.pos.x).toBeCloseTo(4, 6);
  });
});
