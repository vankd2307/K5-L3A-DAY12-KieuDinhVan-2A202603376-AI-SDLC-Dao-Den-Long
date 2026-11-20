import { FormatError } from '../core';

/** `--key value` pairs; `bools` are flags without a value. Unknown keys are a FormatError (exit 2). */
export function parseFlags(argv: string[], keys: string[], bools: string[] = []): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]!;
    if (bools.includes(k)) {
      m.set(k, 'true');
      continue;
    }
    if (!keys.includes(k)) throw new FormatError(`unknown argument ${k}`);
    const v = argv[++i];
    if (v === undefined) throw new FormatError(`missing value for ${k}`);
    m.set(k, v);
  }
  return m;
}

export function intFlag(m: Map<string, string>, k: string, min: number, def: number): number {
  const s = m.get(k);
  if (s === undefined) return def;
  if (!/^-?\d+$/.test(s) || Number(s) < min) throw new FormatError(`${k} must be an integer >= ${min}`);
  return Number(s);
}

/** Runs main(); exit 2 for FormatError, 1 for anything else. */
export async function runCli(main: () => void | Promise<void>): Promise<void> {
  try {
    await main();
  } catch (e) {
    process.stderr.write(`error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(e instanceof FormatError ? 2 : 1);
  }
}

export const rssMb = (): number => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
