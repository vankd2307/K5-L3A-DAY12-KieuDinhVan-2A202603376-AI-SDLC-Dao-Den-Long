import { FormatError, isNum, isObj } from './errors';
import type { FrameInput } from './types';

export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'] as const;

function validateFrame(f: unknown, i: number): InputFrame {
  const where = `inputs.frames[${i}]`;
  if (!isObj(f)) throw new FormatError(`${where}: expected object`);
  if (!isNum(f.tick) || !Number.isInteger(f.tick) || f.tick < 0) throw new FormatError(`${where}.tick: expected integer >= 0`);
  if (f.move !== undefined) {
    const m = f.move;
    if (!Array.isArray(m) || m.length !== 2 || !m.every((c) => isNum(c) && c >= -1 && c <= 1))
      throw new FormatError(`${where}.move: expected [x, z] with each component in [-1, 1]`);
  }
  if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) throw new FormatError(`${where}.cam_yaw_deg: expected number`);
  for (const b of BUTTONS) {
    if (f[b] !== undefined && typeof f[b] !== 'boolean') throw new FormatError(`${where}.${b}: expected boolean`);
  }
  return f as unknown as InputFrame;
}

/**
 * Accepts the contract's `{ "frames": [...] }` JSON, a bare JSON array of frames,
 * or JSONL (one frame object per line) since the CLI flag is named `<file.jsonl>`.
 */
export function parseInputs(text: string): InputFrame[] {
  const src = text.replace(/^﻿/, '').trim();
  let frames: unknown;
  try {
    const whole: unknown = src === '' ? { frames: [] } : JSON.parse(src);
    frames = isObj(whole) && 'frames' in whole ? whole.frames : whole;
  } catch {
    frames = src.split(/\r?\n/).filter((l) => l.trim() !== '').map((line, i) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        throw new FormatError(`inputs line ${i + 1}: invalid JSON`);
      }
    });
  }
  if (isObj(frames)) frames = [frames]; // a single JSONL line
  if (!Array.isArray(frames)) throw new FormatError('inputs: expected { "frames": [...] }');
  const out = frames.map(validateFrame);
  for (let i = 1; i < out.length; i++) {
    if (out[i]!.tick <= out[i - 1]!.tick) throw new FormatError(`inputs.frames[${i}].tick: ticks must strictly increase`);
  }
  return out;
}

/** Resolves held values tick by tick. Call at(k) with k = 0, 1, 2, ... in order. */
export class InputTimeline {
  private i = 0;
  private cur: FrameInput = { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };

  constructor(private readonly frames: InputFrame[]) {}

  at(k: number): FrameInput {
    while (this.i < this.frames.length && this.frames[this.i]!.tick <= k) {
      const f = this.frames[this.i++]!;
      this.cur = {
        move: f.move ? [f.move[0], f.move[1]] : this.cur.move,
        camYawDeg: f.cam_yaw_deg ?? this.cur.camYawDeg,
        jump: f.jump ?? this.cur.jump,
        interact: f.interact ?? this.cur.interact,
        pulse: f.pulse ?? this.cur.pulse,
        dash: f.dash ?? this.cur.dash,
        pause: f.pause ?? this.cur.pause,
      };
    }
    return this.cur;
  }
}
