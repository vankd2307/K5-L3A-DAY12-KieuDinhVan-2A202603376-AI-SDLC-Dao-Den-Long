/**
 * Test Contract v1.1 headless runner:
 *   <headless_cmd> --seed <int> --night <1|2|3> [--scenario f.json] [--inputs f.jsonl]
 *                  --ticks <int> --out f.jsonl [--snapshot-every <int, default 60>]
 * Exit 0 ok; 2 bad arguments / malformed inputs or scenario; 1 any other error.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_SNAPSHOT_EVERY, FormatError, parseInputs, runHeadless } from '../core';

const FLAGS = new Set(['--seed', '--night', '--scenario', '--inputs', '--ticks', '--out', '--snapshot-every']);

function parseArgs(argv: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]!;
    const v = argv[i + 1];
    if (!FLAGS.has(k)) throw new FormatError(`unknown argument ${k}`);
    if (v === undefined) throw new FormatError(`missing value for ${k}`);
    m.set(k, v);
  }
  return m;
}

function int(m: Map<string, string>, k: string, min: number, def?: number): number {
  const s = m.get(k);
  if (s === undefined) {
    if (def !== undefined) return def;
    throw new FormatError(`missing required ${k}`);
  }
  if (!/^-?\d+$/.test(s) || Number(s) < min) throw new FormatError(`${k} must be an integer >= ${min}`);
  return Number(s);
}

function readJson(path: string, what: string): unknown {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  try {
    return JSON.parse(text);
  } catch {
    throw new FormatError(`${what} ${path}: invalid JSON`);
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const seed = int(args, '--seed', -(2 ** 31));
  const night = int(args, '--night', 1);
  if (night > 3) throw new FormatError('--night must be 1, 2 or 3');
  const ticks = int(args, '--ticks', 0);
  const snapshotEvery = int(args, '--snapshot-every', 1, DEFAULT_SNAPSHOT_EVERY);
  const out = args.get('--out');
  if (!out) throw new FormatError('missing required --out');

  const scenarioPath = args.get('--scenario');
  const inputsPath = args.get('--inputs');
  const scenario = scenarioPath ? readJson(scenarioPath, 'scenario') : undefined;
  const frames = inputsPath ? parseInputs(readFileSync(inputsPath, 'utf8')) : [];

  const lines: string[] = [];
  runHeadless({ seed, night: night as 1 | 2 | 3, ticks, snapshotEvery, scenario, frames }, (o) => lines.push(JSON.stringify(o)));
  writeFileSync(out, lines.join('\n') + '\n');
}

try {
  main();
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`error: ${msg}\n`);
  process.exit(e instanceof FormatError ? 2 : 1);
}
