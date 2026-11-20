/**
 * Phase 4 §2 soak test, all Nights in ONE process:
 *   <soak_cmd> --seed 7 --nights 10 --out soak.json
 * Night i (i = 1..N) is Night ((i-1) mod 3) + 1 with seed `seed + i`, random inputs (src/core/soak.ts).
 * mem_start_mb = RSS after the first Night is loaded; mem_end_mb = RSS after the last Night is reset.
 * Run with --expose-gc (soak_cmd does) so both readings are taken after a full GC.
 */
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { FormatError, Game, playSoakNight, soakNight } from '../core';
import { intFlag, parseFlags, rssMb, runCli } from './args';

const gc = (globalThis as { gc?: () => void }).gc ?? (() => {});

void runCli(() => {
  const args = parseFlags(process.argv.slice(2), ['--seed', '--nights', '--out']);
  const seed = intFlag(args, '--seed', -(2 ** 31), 7);
  const nights = intFlag(args, '--nights', 1, 10);
  const out = args.get('--out');
  if (!out) throw new FormatError('missing required --out');

  const t0 = performance.now();
  const results: string[] = [];
  let crashes = 0;
  let memStart = 0;
  let game: Game | null = null;
  for (let i = 1; i <= nights; i++) {
    const nightSeed = seed + i;
    try {
      game = new Game(nightSeed, soakNight(i));
      if (i === 1) {
        gc();
        memStart = rssMb();
      }
      playSoakNight(game, nightSeed);
      results.push(game.result ?? 'timeout');
    } catch (e) {
      crashes++;
      results.push('crash');
      process.stderr.write(`night ${i} (seed ${nightSeed}) crashed: ${e instanceof Error ? e.stack : String(e)}\n`);
    }
    game = null; // reset: drop the finished Night before loading the next one
  }
  gc();
  const memEnd = rssMb();
  const report = {
    nights,
    crashes,
    results,
    mem_start_mb: memStart,
    mem_end_mb: memEnd,
    duration_s: Math.round((performance.now() - t0) / 100) / 10,
  };
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report) + '\n');
});
