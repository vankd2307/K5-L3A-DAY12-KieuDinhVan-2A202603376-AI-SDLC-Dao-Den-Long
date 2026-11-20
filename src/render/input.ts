import type { FrameInput } from '../core';
import type { KeyMap } from './settings';

/**
 * Keyboard + mouse -> contract-style FrameInput, using the player's key map (Phase 4 rebinding).
 * Buttons are latched so a tap shorter than one 1/60 s tick is not lost.
 */
export function createControls(
  canvas: HTMLElement,
  cam: { yaw: () => number; setYaw: (d: number) => void; sensitivity: () => number },
  keys: () => KeyMap,
) {
  const down = new Set<string>();
  const latched = new Set<string>();
  let injectPause = false;
  /** While the settings screen waits for a key, gameplay ignores the keyboard. */
  let capture: ((code: string) => void) | null = null;

  window.addEventListener('keydown', (e) => {
    if (capture) {
      e.preventDefault();
      const cb = capture;
      capture = null;
      cb(e.code);
      return;
    }
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return; // typing a name
    if (Object.values(keys()).includes(e.code)) e.preventDefault();
    if (!down.has(e.code)) latched.add(e.code);
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());

  let dragging = false;
  canvas.addEventListener('mousedown', () => (dragging = true));
  window.addEventListener('mouseup', () => (dragging = false));
  window.addEventListener('mousemove', (e) => {
    if (dragging) cam.setYaw(cam.yaw() - e.movementX * 0.3 * cam.sensitivity());
  });

  const held = (a: keyof KeyMap) => down.has(keys()[a]);
  const pressed = (a: keyof KeyMap) => down.has(keys()[a]) || latched.has(keys()[a]);

  return {
    /** Toggle pause from a UI button (sent as a pause press on the next tick). */
    togglePause() {
      injectPause = true;
    },
    clear() {
      latched.clear();
      down.clear();
    },
    /** Next key press goes to `cb` instead of the game (key rebinding). */
    captureNextKey(cb: (code: string) => void) {
      capture = cb;
    },
    cancelCapture() {
      capture = null;
    },
    updateCamera(dt: number) {
      const turn = (held('camLeft') ? 1 : 0) - (held('camRight') ? 1 : 0);
      if (turn) cam.setYaw(cam.yaw() + turn * 120 * dt * cam.sensitivity());
    },
    sample(): FrameInput {
      const forward = (held('up') ? 1 : 0) - (held('down') ? 1 : 0);
      // Contract: move x=+1 is world +X at yaw 0, which is screen-LEFT for a camera looking +Z.
      const side = (held('left') ? 1 : 0) - (held('right') ? 1 : 0);
      const input: FrameInput = {
        move: [side, forward],
        camYawDeg: cam.yaw(),
        jump: pressed('jump'),
        interact: pressed('interact'),
        pulse: pressed('pulse'),
        dash: pressed('dash'),
        pause: pressed('pause') || injectPause,
      };
      injectPause = false;
      latched.clear();
      return input;
    },
  };
}
