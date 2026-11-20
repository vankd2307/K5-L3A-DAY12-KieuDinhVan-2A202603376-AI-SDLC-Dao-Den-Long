/**
 * Phase 4 §1 benchmark:  npm run bench -- --seed 42 --duration 30 --out bench.json
 * (`npm run bench` builds dist/ first, then runs this file.)
 *
 * Serves dist/ with `vite preview`, starts the installed Chrome/Chromium/Edge in a real 1280×720
 * window with vsync and the frame-rate cap off, opens the bench scene (?bench) and reads its frame
 * times over the DevTools protocol (Node 22 WebSocket, no extra dependency). Memory = summed RSS of
 * the Chrome process tree (browser, GPU, renderer...) from the OS, sampled about once a second.
 *   --chrome <path>   browser executable (or env CHROME_PATH)
 *   --headless        no window (CI only; numbers are not comparable)
 */
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, release, tmpdir, type as osType, arch } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { preview } from 'vite';
import { BENCH, benchStats, FormatError } from '../src/core';
import { intFlag, parseFlags, runCli } from '../src/headless/args';
import type { BenchResult } from '../src/render/bench';

const CONTRACT_VERSION = '1.3';
const VIEW = { w: 1280, h: 720 };
const root = resolve(import.meta.dirname, '..');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const run = promisify(execFile);

function findChrome(given?: string): string {
  const env = process.env;
  const candidates = [
    given,
    env.CHROME_PATH,
    ...(process.platform === 'win32'
      ? [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].flatMap((d) =>
          d ? [join(d, 'Google/Chrome/Application/chrome.exe'), join(d, 'Microsoft/Edge/Application/msedge.exe')] : [])
      : process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
        : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium']),
  ];
  const hit = candidates.find((c) => c && existsSync(c));
  if (!hit) throw new Error('Chrome/Chromium/Edge not found: pass --chrome <path> or set CHROME_PATH');
  return hit;
}

/** Minimal DevTools-protocol client over one browser WebSocket (flattened sessions). */
class Cdp {
  private id = 0;
  private pending = new Map<number, { ok: (v: any) => void; err: (e: Error) => void }>();
  private constructor(private ws: WebSocket) {
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      const p = msg.id !== undefined ? this.pending.get(msg.id) : undefined;
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.err(new Error(`${msg.error.message}`));
      else p.ok(msg.result);
    });
    // a closed socket (e.g. after Browser.close) must not leave calls waiting forever
    ws.addEventListener('close', () => {
      for (const p of this.pending.values()) p.err(new Error('DevTools connection closed'));
      this.pending.clear();
    });
  }
  static open(url: string): Promise<Cdp> {
    return new Promise((ok, err) => {
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => ok(new Cdp(ws)), { once: true });
      ws.addEventListener('error', () => err(new Error(`cannot connect to ${url}`)), { once: true });
    });
  }
  send(method: string, params: object = {}, sessionId?: string): Promise<any> {
    const id = ++this.id;
    if (process.env.BENCH_DEBUG) process.stderr.write(`[cdp ${(performance.now() / 1000).toFixed(1)}s] ${method}
`);
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((ok, err) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        err(new Error(`${method}: no answer in 20 s`));
      }, 20000);
      this.pending.set(id, { ok: (v) => [clearTimeout(timer), ok(v)], err: (e) => [clearTimeout(timer), err(e)] });
    });
  }
  close(): void {
    this.ws.close();
  }
}

/**
 * Summed resident memory (MB) of a process and all its descendants (Chrome = browser + GPU +
 * renderers + utilities), read from the OS process table.
 */
async function treeRssMb(rootPid: number): Promise<number> {
  const rows: Array<[pid: number, ppid: number, bytes: number]> = [];
  if (process.platform === 'win32') {
    const { stdout } = await run('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $($_.WorkingSetSize)" }']);
    for (const l of stdout.split(/\r?\n/)) {
      const [a, b, c] = l.trim().split(/\s+/).map(Number);
      if (a && b !== undefined && c !== undefined) rows.push([a, b, c]);
    }
  } else {
    const { stdout } = await run('ps', ['-A', '-o', 'pid=,ppid=,rss=']);
    for (const l of stdout.split('\n')) {
      const [a, b, c] = l.trim().split(/\s+/).map(Number);
      if (a && b !== undefined && c !== undefined) rows.push([a, b, c * 1024]);
    }
  }
  const tree = new Set([rootPid]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [pid, ppid] of rows) if (tree.has(ppid) && !tree.has(pid)) [tree.add(pid), (grew = true)];
  }
  return rows.filter(([pid]) => tree.has(pid)).reduce((s, r) => s + r[2], 0) / 1048576;
}

async function waitFor<T>(what: string, ms: number, fn: () => Promise<T | null | undefined> | T | null | undefined): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v !== null && v !== undefined) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(100);
  }
}

void runCli(async () => {
  const args = parseFlags(process.argv.slice(2), ['--seed', '--duration', '--out', '--chrome'], ['--headless']);
  const seed = intFlag(args, '--seed', -(2 ** 31), 42);
  const duration = intFlag(args, '--duration', 1, 30);
  const outArg = args.get('--out');
  if (!outArg) throw new FormatError('missing required --out');
  const out = isAbsolute(outArg) ? outArg : resolve(process.env.INIT_CWD ?? process.cwd(), outArg);
  if (!existsSync(join(root, 'dist/index.html'))) throw new Error('dist/ missing: run `npm run build` (npm run bench does it)');

  const server = await preview({ root, logLevel: 'warn', preview: { port: 4190, strictPort: false, open: false } });
  const base = server.resolvedUrls?.local[0] ?? 'http://localhost:4190/';
  const profile = mkdtempSync(join(tmpdir(), 'ddl-bench-'));
  const flags = [
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-sync', '--disable-features=Translate,MediaRouter',
    '--disable-gpu-vsync', '--disable-frame-rate-limit', // vsync off (Phase 4 §1.1)
    '--force-device-scale-factor=1', `--window-size=${VIEW.w},${VIEW.h}`, '--window-position=20,20',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    ...(args.has('--headless') ? ['--headless=new'] : []),
    'about:blank',
  ];
  const chromePath = findChrome(args.get('--chrome'));
  // BENCH_CHROME_LOG=<file>: keep Chrome's own log (crashes, GPU errors) for debugging
  const logFile = process.env.BENCH_CHROME_LOG;
  if (logFile) flags.unshift('--enable-logging', '--v=0', `--log-file=${logFile}`);
  const chrome: ChildProcess = spawn(chromePath, flags, { stdio: 'ignore' });
  chrome.on('exit', (code, sig) => process.env.BENCH_DEBUG && process.stderr.write(`[chrome exited code=${code} signal=${sig}]
`));
  let cdp: Cdp | null = null;
  try {
    const portFile = join(profile, 'DevToolsActivePort');
    const [port, path] = await waitFor('DevToolsActivePort', 20000, () => {
      try {
        const lines = readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
        return lines.length >= 2 ? lines : null;
      } catch {
        return null; // not there yet, or Chrome is still writing it (EBUSY on Windows)
      }
    });
    cdp = await Cdp.open(`ws://127.0.0.1:${port}${path}`);
    const version = await cdp.send('Browser.getVersion');

    // one page target, window grown so the viewport is exactly 1280×720
    const targets = (await cdp.send('Target.getTargets')).targetInfos as Array<{ targetId: string; type: string }>;
    const page = targets.find((t) => t.type === 'page') ?? { targetId: (await cdp.send('Target.createTarget', { url: 'about:blank' })).targetId };
    let sessionId: string = (await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true })).sessionId;
    const evaluate = async (expr: string) =>
      (await cdp!.send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId)).result.value;
    /** Navigation can move the page to a new renderer and drop the session: attach again by URL. */
    const reattach = async () => {
      const infos = (await cdp!.send('Target.getTargets')).targetInfos as Array<{ targetId: string; type: string; url: string }>;
      const t = infos.find((x) => x.type === 'page' && x.url.includes('?bench'));
      if (t) sessionId = (await cdp!.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId;
    };
    /** evaluate() that survives a lost session / busy page while waiting: null means "ask again". */
    const poll = async (expr: string) => {
      try {
        return await evaluate(expr);
      } catch (e) {
        if (/session/i.test(String(e))) await reattach().catch(() => {});
        return null;
      }
    };
    if (!args.has('--headless')) {
      const { windowId, bounds } = await cdp.send('Browser.getWindowForTarget', { targetId: page.targetId });
      const [iw, ih] = (await evaluate('[innerWidth, innerHeight]')) as [number, number];
      await cdp.send('Browser.setWindowBounds', { windowId, bounds: { width: bounds.width + VIEW.w - iw, height: bounds.height + VIEW.h - ih } });
    } else {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: VIEW.w, height: VIEW.h, deviceScaleFactor: 1, mobile: false }, sessionId);
    }
    await cdp.send('Page.navigate', { url: `${base}?bench&seed=${seed}&duration=${duration}` }, sessionId);

    const firstFrame = (await waitFor('first bench frame', 30000, () => poll('window.__bench && window.__bench.firstFrameEpochMs'))) as number;
    const loadMs = Math.round(firstFrame - performance.timeOrigin);
    const viewport = (await waitFor('viewport', 20000, () => poll('[innerWidth, innerHeight]'))) as [number, number];

    // sample memory while the bench measures (after the warm-up)
    let peak = 0;
    let done: BenchResult | null = null;
    const deadline = Date.now() + (BENCH.warmupS + duration + 60) * 1000;
    while (!done) {
      if (Date.now() > deadline) throw new Error('bench did not finish in time');
      done = (await poll('window.__bench && window.__bench.result')) as BenchResult | null;
      if (process.env.BENCH_DEBUG) process.stderr.write(`[progress] frames ${String(await poll('window.__bench && window.__bench.frames'))}\n`);
      if (chrome.pid) peak = Math.max(peak, await treeRssMb(chrome.pid).catch(() => 0));
      if (!done) await sleep(1000);
    }

    const stats = benchStats(done.dts);
    const report = {
      contract_version: CONTRACT_VERSION,
      ...{ avg_fps: stats.avg_fps, p1_low_fps: stats.p1_low_fps, frame_ms_p95: stats.frame_ms_p95, frames: stats.frames },
      load_ms: loadMs,
      peak_mem_mb: Math.round(peak),
      vsync_off: true,
      renderer: `${done.renderer} (${version.product}, flags --disable-gpu-vsync --disable-frame-rate-limit, viewport ${viewport.join('x')})`,
      os: `${osType()} ${release()} ${arch()}, ${cpus()[0]?.model.trim() ?? 'unknown CPU'}`,
      seed,
      duration_s: duration,
    };
    writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    // where the frame time goes (stderr only, not part of bench.json)
    const q = (a: number[], f: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(f * a.length))]!.toFixed(2);
    const mean = (a: number[]) => (a.reduce((s, v) => s + v, 0) / a.length).toFixed(2);
    for (const [k, a] of Object.entries({ dt: done.dts, ...done.profile })) {
      process.stderr.write(`profile ${k.padEnd(6)} mean ${mean(a)} ms  p50 ${q(a, 0.5)}  p95 ${q(a, 0.95)}  p99 ${q(a, 0.99)}  max ${q(a, 1)}\n`);
    }
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } finally {
    await cdp?.send('Browser.close').catch(() => {});
    cdp?.close();
    await waitFor('browser exit', 10000, () => (chrome.exitCode !== null || chrome.signalCode !== null ? true : null)).catch(() => chrome.kill());
    await server.close();
    for (let i = 0; i < 10; i++) {
      try {
        rmSync(profile, { recursive: true, force: true });
        break;
      } catch {
        await sleep(300);
      }
    }
  }
  process.exit(0);
});
