import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-'));
const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));

/** Runs the exact headless_cmd declared in game.contract.json. */
function cli(args: string[]) {
  const [cmd, ...pre] = (contract.headless_cmd as string).split(' ');
  const r = spawnSync(cmd === 'node' ? process.execPath : cmd!, [...pre, ...args], { cwd: root, encoding: 'utf8' });
  return { code: r.status, stderr: r.stderr };
}

const file = (name: string, content: string) => {
  const p = join(tmp, name);
  writeFileSync(p, content);
  return p;
};

describe('headless CLI (contract B)', () => {
  it('writes JSONL ending with an end line and exits 0', () => {
    const out = join(tmp, 'a.jsonl');
    const inputs = file('in.json', JSON.stringify({ frames: [{ tick: 0, move: [0, 1] }] }));
    const r = cli(['--seed', '3', '--night', '1', '--inputs', inputs, '--ticks', '120', '--out', out]);
    expect(r.code).toBe(0);
    const lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines[0]).toMatchObject({ type: 'snapshot', tick: 0 });
    expect(lines.at(-1)).toMatchObject({ type: 'end', ticks: 120 });
  });
  it('same args twice -> byte-identical output', () => {
    const o1 = join(tmp, 'd1.jsonl');
    const o2 = join(tmp, 'd2.jsonl');
    cli(['--seed', '99', '--night', '1', '--ticks', '2000', '--out', o1]);
    cli(['--seed', '99', '--night', '1', '--ticks', '2000', '--out', o2]);
    expect(readFileSync(o1, 'utf8')).toBe(readFileSync(o2, 'utf8'));
  });
  it('accepts JSONL inputs (one frame per line)', () => {
    const inputs = file('in.jsonl', '{"tick":0,"move":[1,0]}\n{"tick":10,"move":[0,0]}\n');
    expect(cli(['--seed', '1', '--night', '1', '--inputs', inputs, '--ticks', '20', '--out', join(tmp, 'j.jsonl')]).code).toBe(0);
  });
  it.each([
    ['broken JSON', '{"frames": [ {"tick": 0 '],
    ['non-increasing ticks', JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] })],
    ['bad move', JSON.stringify({ frames: [{ tick: 0, move: [2, 0] }] })],
    ['bad button type', JSON.stringify({ frames: [{ tick: 0, pulse: 'yes' }] })],
  ])('malformed inputs (%s) -> exit 2 with stderr', (_, content) => {
    const r = cli(['--seed', '1', '--night', '1', '--inputs', file('bad.json', content), '--ticks', '5', '--out', join(tmp, 'x.jsonl')]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/error/);
  });
  it('malformed scenario -> exit 2', () => {
    const sc = file('bad-sc.json', JSON.stringify({ lanterns: [{ id: 'L9' }] }));
    expect(cli(['--seed', '1', '--night', '1', '--scenario', sc, '--ticks', '5', '--out', join(tmp, 'y.jsonl')]).code).toBe(2);
  });
  it('missing file -> non-zero exit', () => {
    const r = cli(['--seed', '1', '--night', '1', '--inputs', join(tmp, 'nope.json'), '--ticks', '5', '--out', join(tmp, 'z.jsonl')]);
    expect(r.code).not.toBe(0);
  });
});
