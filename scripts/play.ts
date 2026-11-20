/**
 * run_cmd (game.contract.json):  npm start
 *   (no flags)                         start the game (Vite dev server) and open it in the browser
 *   --export-leaderboard <out.json>    write {"entries":[...]} (top 10, ranked) from the local file and exit
 *   --no-open                          do not open a browser tab
 */
import { writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createServer } from 'vite';
import { FormatError } from '../src/core';
import { parseFlags, runCli } from '../src/headless/args';
import { exportJson } from '../src/leaderboard';
import { boardPath, readBoard } from '../src/node/leaderboard-file';

const root = resolve(import.meta.dirname, '..');

void runCli(async () => {
  const args = parseFlags(process.argv.slice(2), ['--export-leaderboard'], ['--no-open']);
  const out = args.get('--export-leaderboard');
  if (out !== undefined) {
    if (!out) throw new FormatError('missing value for --export-leaderboard');
    const path = isAbsolute(out) ? out : resolve(process.env.INIT_CWD ?? process.cwd(), out);
    const entries = readBoard();
    writeFileSync(path, exportJson(entries));
    process.stdout.write(`${entries.length} entries from ${boardPath()} -> ${path}\n`);
    return;
  }
  const server = await createServer({ root, server: { open: !args.has('--no-open') } });
  await server.listen();
  server.printUrls();
  process.stdout.write(`Bảng xếp hạng lưu ở ${boardPath()}\n`);
});
