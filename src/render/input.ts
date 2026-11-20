import type { FrameInput } from '../core';

/**
 * Keyboard + mouse -> contract-style FrameInput.
 * Buttons are latched so a tap shorter than one 1/60 s tick is not lost.
 */
export function createControls(canvas: HTMLElement, cam: { yaw: () => number; setYaw: (d: number) => void; sensitivity: () => number }) {
  const down = new Set<string>();
  const latched = new Set<string>();
  let injectPause = false;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
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

  const held = (...codes: string[]) => codes.some((c) => down.has(c));
  const pressed = (...codes: string[]) => codes.some((c) => down.has(c) || latched.has(c));

  return {
    /** Toggle pause from a UI button (sent as a pause press on the next tick). */
    togglePause() {
      injectPause = true;
    },
    clear() {
      latched.clear();
    },
    updateCamera(dt: number) {
      const turn = (held('ArrowLeft') ? 1 : 0) - (held('ArrowRight') ? 1 : 0);
      if (turn) cam.setYaw(cam.yaw() + turn * 120 * dt * cam.sensitivity());
    },
    sample(): FrameInput {
      const forward = (held('KeyW', 'ArrowUp') ? 1 : 0) - (held('KeyS', 'ArrowDown') ? 1 : 0);
      // Contract: move x=+1 is world +X at yaw 0, which is screen-LEFT for a camera looking +Z.
      const side = (held('KeyA') ? 1 : 0) - (held('KeyD') ? 1 : 0);
      const input: FrameInput = {
        move: [side, forward],
        camYawDeg: cam.yaw(),
        jump: pressed('Space'),
        interact: pressed('KeyE'),
        pulse: pressed('KeyF'),
        dash: pressed('ShiftLeft', 'ShiftRight', 'KeyQ'),
        pause: pressed('Escape', 'KeyP') || injectPause,
      };
      injectPause = false;
      latched.clear();
      return input;
    },
  };
}
