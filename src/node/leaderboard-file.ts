/**
 * Leaderboard on local disk (Phase 4 §3): <home>/.dao-den-long/leaderboard.json, or $DDL_DATA_DIR.
 * Used by the Vite dev/preview middleware (the game saves through /api/leaderboard) and by
 * `npm start -- --export-leaderboard out.json`.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Connect } from 'vite';
import { exportJson, merge, validEntries, type Entry } from '../leaderboard';

export const dataDir = (): string => process.env.DDL_DATA_DIR ?? join(homedir(), '.dao-den-long');
export const boardPath = (): string => join(dataDir(), 'leaderboard.json');

export function readBoard(path = boardPath()): Entry[] {
  if (!existsSync(path)) return [];
  try {
    return validEntries(JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, '')));
  } catch {
    return [];
  }
}

export function writeBoard(entries: readonly Entry[], path = boardPath()): void {
  mkdirSync(join(path, '..'), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, exportJson(entries));
  renameSync(tmp, path); // atomic replace: a crash never leaves a half-written file
}

/** GET → {entries}; POST {entry} or {entries} (merge, e.g. scores saved offline) → {entries}. */
export function leaderboardMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url?.startsWith('/api/leaderboard')) return next();
    const reply = (code: number, body: unknown) => {
      res.statusCode = code;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET') return reply(200, { entries: readBoard() });
    if (req.method !== 'POST') return reply(405, { error: 'method not allowed' });
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      chunks.push(c);
      if ((size += c.length) > 64_000) req.destroy();
    });
    req.on('end', () => {
      try {
        // decode once at the end: a UTF-8 character (e.g. "ỏ") may be split across chunks
        const msg = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { entry?: unknown; entries?: unknown };
        let board = readBoard();
        if (msg.entries !== undefined) board = merge(board, validEntries(msg.entries));
        if (msg.entry !== undefined) {
          const [entry] = validEntries([msg.entry]);
          if (!entry) return reply(400, { error: 'invalid entry' });
          board = merge(board, [entry]);
        }
        writeBoard(board);
        reply(200, { entries: board });
      } catch {
        reply(400, { error: 'invalid JSON' });
      }
    });
  };
}
