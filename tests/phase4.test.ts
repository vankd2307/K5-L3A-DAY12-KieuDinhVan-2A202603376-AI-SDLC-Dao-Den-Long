import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BENCH, benchCamera, benchStats, createBenchGame, Game, IDLE_INPUT, parseInputs, playSoakNight, runHeadless, soakInputs, soakNight,
} from '../src/core';
import { addEntry, exportJson, isoWithOffset, merge, nameError, rank, validEntries, type Entry } from '../src/leaderboard';
import { ACTIONS, conflictOf, DEFAULT_KEYS, keyLabel, rebind } from '../src/render/settings';

const root = join(__dirname, '..');

describe('P4-BENCH scene (§1)', () => {
  const g = createBenchGame(42);
  it('exactly 200 wandering shades, 100 motes, L1–L3 lit with fuel 100, Night 1', () => {
    expect(g.night).toBe(1);
    expect(g.shades).toHaveLength(200);
    expect(g.shades.every((s) => s.state === 'wander')).toBe(true);
    expect(new Set(g.shades.map((s) => s.id)).size).toBe(200);
    expect(g.motes).toHaveLength(100);
    expect(g.lanterns.map((l) => [l.id, l.lit, g.fuelOf(l)])).toEqual([
      ['L1', true, 100], ['L2', true, 100], ['L3', true, 100], ['L4', false, 0], ['L5', false, 0]]);
    expect(g.player.pos).toEqual([0, 0, 0]);
  });
  it('spread over the whole island (every quadrant), all on land, seeded', () => {
    for (const s of g.shades) expect(Math.hypot(s.pos[0], s.pos[2])).toBeLessThanOrEqual(40);
    const quad = (x: number, z: number) => (x >= 0 ? 1 : 0) + (z >= 0 ? 2 : 0);
    const counts = [0, 0, 0, 0];
    for (const s of g.shades) counts[quad(s.pos[0], s.pos[2])]!++;
    for (const c of counts) expect(c).toBeGreaterThan(30); // ~50 each if uniform
    expect(createBenchGame(42).shades.map((s) => s.pos)).toEqual(g.shades.map((s) => s.pos));
    expect(createBenchGame(43).shades[0]!.pos).not.toEqual(g.shades[0]!.pos);
  });
  it('no spawns, damage, pickups, fuel decay or end; shades keep moving in wander', () => {
    const b = createBenchGame(42);
    // put a shade and a mote right on Mây
    b.shades[0]!.pos = [0.2, 1, 0];
    b.motes[0]!.pos = [0.3, 0, 0];
    const start = b.shades.map((s) => [...s.pos]);
    const events = [];
    for (let k = 0; k < 60 * 300; k++) events.push(...b.step(IDLE_INPUT)); // past the 240 s Night length
    expect(events).toEqual([]);
    expect(b.over).toBe(false);
    expect(b.shades).toHaveLength(200);
    expect(b.motes).toHaveLength(100);
    expect(b.player.flames).toBe(3);
    expect(b.player.carried).toBe(0);
    expect(b.lanterns.slice(0, 3).map((l) => g.fuelOf(l))).toEqual([100, 100, 100]);
    expect(b.shades.every((s) => s.state === 'wander')).toBe(true);
    const moved = b.shades.filter((s, i) => Math.hypot(s.pos[0] - start[i]![0]!, s.pos[2] - start[i]![2]!) > 1).length;
    expect(moved).toBeGreaterThan(150);
  }, 30000); // 18 000 ticks x 200 shades: ~5 s
  it('camera orbit: (30,15,0) at 0 s, counter-clockwise seen from above (x = r cos a, z = r sin a), 15 s per lap', () => {
    const c = (t: number) => benchCamera(t).map((v) => Math.round(v * 1000) / 1000 + 0);
    expect(c(0)).toEqual([30, 15, 0]);
    expect(c(3.75)).toEqual([0, 15, 30]);
    expect(c(7.5)).toEqual([-30, 15, 0]);
    expect(c(15)).toEqual([30, 15, 0]);
    expect(BENCH.warmupS).toBe(3);
  });
});

describe('P4-STATS bench formulas (§1)', () => {
  it('avg, 1% low (k = max(1, ceil(0.01 N)) largest dt), p95', () => {
    // 98 frames of 10 ms + 2 of 40 ms: N = 100, k = 1
    const dts = [...Array(98).fill(10), 40, 40];
    const s = benchStats(dts);
    expect(s.frames).toBe(100);
    expect(s.avg_fps).toBe(Math.round((1000 * 100) / (980 + 80) * 10) / 10);
    expect(s.p1_low_fps).toBe(25); // 1000 / 40
    expect(s.frame_ms_p95).toBe(10);
  });
  it('k rounds up: N = 150 -> k = 2', () => {
    const s = benchStats([...Array(148).fill(5), 20, 30]);
    expect(s.p1_low_fps).toBe(40); // 1000 / 25
  });
  it('p95 picks the 95th percentile', () => {
    const dts = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100 ms
    expect(benchStats(dts).frame_ms_p95).toBe(95);
  });
});

describe('P4-SOAK (§2)', () => {
  it('nights rotate 1 → 2 → 3 → 1', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 10].map(soakNight)).toEqual([1, 2, 3, 1, 2, 3, 1, 1]);
  });
  it('random inputs: direction changes only every 30 ticks; button rates ≈ 5/3/2/10 %', () => {
    const inp = soakInputs(7);
    const frames = Array.from({ length: 60000 }, (_, k) => inp(k));
    for (let k = 1; k < 30; k++) expect(frames[k]!.move).toEqual(frames[0]!.move);
    expect(frames[30]!.move).not.toEqual(frames[0]!.move);
    const rate = (b: 'jump' | 'dash' | 'pulse' | 'interact') => frames.filter((f) => f[b]).length / frames.length;
    expect(rate('jump')).toBeCloseTo(0.05, 2);
    expect(rate('dash')).toBeCloseTo(0.03, 2);
    expect(rate('pulse')).toBeCloseTo(0.02, 2);
    expect(rate('interact')).toBeCloseTo(0.1, 2);
  });
  it('a soak night ends (or reaches its full length) and is deterministic', () => {
    const a = playSoakNight(new Game(8, 1), 8);
    const b = playSoakNight(new Game(8, 1), 8);
    expect(a.over || a.simTick === 240 * 60).toBe(true);
    expect([a.tick, a.score, a.result]).toEqual([b.tick, b.score, b.result]);
  });
  it('soak_cmd writes soak.json with 0 crashes and bounded memory', () => {
    const c = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
    const out = join(mkdtempSync(join(tmpdir(), 'soak-')), 'soak.json');
    const [cmd, ...pre] = (c.soak_cmd as string).split(' ');
    const r = spawnSync(cmd === 'node' ? process.execPath : cmd!, [...pre, '--seed', '7', '--nights', '4', '--out', out], { cwd: root, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    const j = JSON.parse(readFileSync(out, 'utf8'));
    expect(j).toMatchObject({ nights: 4, crashes: 0 });
    expect(j.results).toHaveLength(4);
    expect(j.mem_end_mb).toBeLessThanOrEqual(1.2 * j.mem_start_mb);
    expect(typeof j.duration_s).toBe('number');
  }, 60000);
});

describe('P4-HEADLESS unchanged by Phase 4', () => {
  it('replaying the Phase 3 bot inputs reproduces the committed Phase 3 output byte for byte', () => {
    const dir = join(root, 'docs/proof/phase-3');
    const frames = parseInputs(readFileSync(join(dir, 'autoplay-n1-seed1.inputs.json'), 'utf8'));
    const lines: string[] = [];
    runHeadless({ seed: 1, night: 1, ticks: 14400, snapshotEvery: 60, frames }, (o) => lines.push(JSON.stringify(o)));
    expect(lines.join('\n') + '\n').toBe(readFileSync(join(dir, 'autoplay-n1-seed1.out.jsonl'), 'utf8'));
  });
});

const E = (name: string, score: number, at: string, nights_won = 1, seed = 1): Entry => ({ name, score, nights_won, achieved_at: at, seed });

describe('P4-BOARD leaderboard (§3)', () => {
  it('names: 3–12 of [A-Za-z0-9_]; Vietnamese with diacritics accepted (bonus)', () => {
    for (const ok of ['Van', 'abc_123', 'ABCDEFGHIJKL', 'Mây', 'Nguyễn_Văn', 'Đăng']) expect(nameError(ok), ok).toBeNull();
    for (const bad of ['ab', 'ABCDEFGHIJKLM', 'a b c', 'abc!', 'ab-c', '', '名前です', 'ab\u0000c']) expect(nameError(bad), bad).not.toBeNull();
  });
  it('score desc; equal score → earlier achieved_at first; top 10 only', () => {
    const list = [
      E('late', 500, '2026-11-20T10:00:00+07:00'),
      E('early', 500, '2026-11-20T09:00:00+07:00'),
      E('utc', 500, '2026-11-20T01:30:00Z'), // = 08:30 +07:00, earliest of the three
      E('top', 900, '2026-11-21T00:00:00+07:00'),
    ];
    expect(rank(list).map((e) => e.name)).toEqual(['top', 'utc', 'early', 'late']);
    let board: Entry[] = [];
    for (let i = 0; i < 12; i++) board = addEntry(board, E(`p${i}xx`, i * 10, `2026-11-20T10:00:${String(i).padStart(2, '0')}+07:00`));
    expect(board).toHaveLength(10);
    expect(board[0]!.score).toBe(110);
    expect(board.at(-1)!.score).toBe(20);
    // same score added later goes below the earlier one
    board = addEntry(board, E('again', 110, '2026-11-20T11:00:00+07:00'));
    expect(board.slice(0, 2).map((e) => e.name)).toEqual(['p11xx', 'again']);
  });
  it('entries have name, score, nights_won 0–3, ISO 8601 achieved_at with time zone, seed; corrupt rows dropped', () => {
    const iso = isoWithOffset(new Date(2026, 10, 20, 21, 5, 9));
    expect(iso).toMatch(/^2026-11-20T21:05:09[+-]\d{2}:\d{2}$/);
    const raw = [E('good', 1, iso), { ...E('bad', 1, '2026-11-20 21:05'), x: 1 }, E('ok3', 1, iso, 4), { name: 'nos' }, 'x'];
    expect(validEntries(raw).map((e) => e.name)).toEqual(['good']);
    expect(Object.keys(validEntries(raw)[0]!)).toEqual(['name', 'score', 'nights_won', 'achieved_at', 'seed']);
  });
  it('export is {"entries": [...]} in rank order; merge removes duplicates', () => {
    const a = E('aaa', 10, '2026-11-20T10:00:00+07:00');
    const b = E('bbb', 20, '2026-11-20T10:00:00+07:00');
    expect(JSON.parse(exportJson([a, b]))).toEqual({ entries: [b, a] });
    expect(merge([a, b], [a])).toEqual([b, a]);
  });
  it('--export-leaderboard writes the file store, ranked (survives restart: it is a file on disk)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'board-'));
    const board = [E('aaa', 10, '2026-11-20T10:00:00+07:00'), E('bbb', 30, '2026-11-20T10:00:00+07:00')];
    const fs = require('node:fs') as typeof import('node:fs');
    fs.writeFileSync(join(dir, 'leaderboard.json'), JSON.stringify({ entries: board }));
    const out = join(dir, 'out.json');
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/play.ts', '--export-leaderboard', out], {
      cwd: root, encoding: 'utf8', env: { ...process.env, DDL_DATA_DIR: dir },
    });
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual({ entries: [board[1], board[0]] });
  }, 30000);
});

describe('P4-ACCESS (§4)', () => {
  it('every action is rebindable, defaults have no duplicates', () => {
    expect(ACTIONS).toEqual(expect.arrayContaining(['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause']));
    expect(new Set(Object.values(DEFAULT_KEYS)).size).toBe(ACTIONS.length);
  });
  it('a duplicate key is refused and the clashing action is reported', () => {
    expect(rebind(DEFAULT_KEYS, 'jump', 'KeyE')).toEqual({ ok: false, conflict: 'interact' });
    expect(conflictOf(DEFAULT_KEYS, 'jump', 'Space')).toBeNull(); // same action, same key: fine
    const r = rebind(DEFAULT_KEYS, 'jump', 'KeyJ');
    expect(r.ok && r.keys.jump).toBe('KeyJ');
    expect(DEFAULT_KEYS.jump).toBe('Space'); // defaults untouched (reset works)
    expect(keyLabel('KeyJ')).toBe('J');
  });
  it('UI text is at least 18 px at 1280×720 (all CSS font sizes ≥ 18px / 1rem, root 18px, large ×1.25)', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    expect(css).toMatch(/html \{ font-size: 18px; \}/);
    expect(css).toMatch(/html\.large \{ font-size: 22\.5px; \}/);
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)(px|rem|em|%)/g)].map((m) => [Number(m[1]), m[2]] as const);
    expect(sizes.length).toBeGreaterThan(10);
    for (const [v, unit] of sizes) {
      if (unit === 'px') expect(v).toBeGreaterThanOrEqual(18);
      else expect(unit).toBe('rem'), expect(v).toBeGreaterThanOrEqual(1);
    }
  });
});
