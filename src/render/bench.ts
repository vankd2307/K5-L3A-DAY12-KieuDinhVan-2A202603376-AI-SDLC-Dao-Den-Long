import * as THREE from 'three';
import { BENCH, benchCamera, createBenchGame, IDLE_INPUT, TICK_RATE } from '../core';
import type { Hud } from './hud';
import type { SceneView } from './scene';

export interface BenchResult {
  dts: number[];
  firstFrameEpochMs: number;
  renderer: string;
  /** ms spent per measured frame in each part: where the time goes */
  profile: { sim: number[]; render: number[]; hud: number[] };
}

declare global {
  interface Window {
    __bench?: { firstFrameEpochMs: number | null; frames: number; result: BenchResult | null };
  }
}

/**
 * Phase 4 §1 benchmark scene in the real renderer: Night 1, 200 wandering shades, 100 motes,
 * L1–L3 lit, no input, camera orbiting (0,0,0). Frame times after the 3 s warm-up are handed to
 * scripts/bench.ts through window.__bench (read over the DevTools protocol).
 */
export function runBench(view: SceneView, hud: Hud, seed: number, durationS: number): void {
  const game = createBenchGame(seed);
  view.load(game);
  hud.show(true);
  const state: NonNullable<Window['__bench']> = { firstFrameEpochMs: null, frames: 0, result: null };
  window.__bench = state;

  const DT = 1 / TICK_RATE;
  const dts: number[] = [];
  const prof = { sim: [] as number[], render: [] as number[], hud: [] as number[] };
  let start = -1;
  let last = 0;
  let acc = 0;
  const frame = (now: number): void => {
    if (start < 0) {
      start = now;
      last = now;
    }
    const tS = (now - start) / 1000;
    const dtMs = now - last;
    last = now;
    acc += Math.min(dtMs / 1000, 0.25);
    const t0 = performance.now();
    while (acc >= DT) {
      game.step(IDLE_INPUT);
      acc -= DT;
    }
    const t1 = performance.now();
    view.fixedCamera = benchCamera(tS);
    view.render(game, dtMs / 1000, now / 1000);
    const t2 = performance.now();
    hud.update(game, view, dtMs / 1000, now / 1000);
    const t3 = performance.now();
    if (tS > BENCH.warmupS) [prof.sim.push(t1 - t0), prof.render.push(t2 - t1), prof.hud.push(t3 - t2)];
    if (state.firstFrameEpochMs === null) state.firstFrameEpochMs = performance.timeOrigin + performance.now();
    state.frames++;
    if (tS > BENCH.warmupS) dts.push(dtMs);
    if (tS >= BENCH.warmupS + durationS) {
      state.result = { dts, firstFrameEpochMs: state.firstFrameEpochMs, renderer: describeRenderer(view.renderer), profile: prof };
      return; // stop: the bench script closes the browser
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function describeRenderer(r: THREE.WebGLRenderer): string {
  const gl = r.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  const api = r.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1';
  const info = `${r.info.render.calls} draw calls, ${r.info.render.triangles} triangles per frame`;
  return `Three.js r${THREE.REVISION} ${api} (${info}) / ${gpu} / ${navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] ?? navigator.userAgent}`;
}
