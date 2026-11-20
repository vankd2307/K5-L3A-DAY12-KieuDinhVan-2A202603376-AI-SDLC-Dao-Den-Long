import type { FrameInput } from '../core';

/**
 * Keyboard + mouse -> contract-style FrameInput.
 * Buttons are latched so a tap shorter than one 1/60 s tick is not lost.
 */
export function createControls(canvas: HTMLElement, getYaw: () => number, setYaw: (deg: number) => void) {
  const down = new Set<string>();
  const latched = new Set<string>();
  const handlers = { restart: () => {} };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!down.has(e.code)) latched.add(e.code);
    down.add(e.code);
    if (e.code === 'KeyR') handlers.restart();
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());

  let dragging = false;
  canvas.addEventListener('mousedown', () => (dragging = true));
  window.addEventListener('mouseup', () => (dragging = false));
  window.addEventListener('mousemove', (e) => {
    if (dragging) setYaw(getYaw() - e.movementX * 0.3);
  });

  const held = (...codes: string[]) => codes.some((c) => down.has(c));
  const pressed = (...codes: string[]) => codes.some((c) => down.has(c) || latched.has(c));

  return {
    handlers,
    /** Camera yaw from arrow keys, in real time. */
    updateCamera(dt: number) {
      const turn = (held('ArrowLeft') ? 1 : 0) - (held('ArrowRight') ? 1 : 0);
      if (turn) setYaw(getYaw() + turn * 120 * dt);
    },
    sample(): FrameInput {
      const forward = (held('KeyW') ? 1 : 0) - (held('KeyS') ? 1 : 0);
      // Contract: move x=+1 is world +X at yaw 0, which is screen-LEFT for a camera looking +Z.
      const side = (held('KeyA') ? 1 : 0) - (held('KeyD') ? 1 : 0);
      const input: FrameInput = {
        move: [side, forward],
        camYawDeg: getYaw(),
        jump: pressed('Space'),
        interact: pressed('KeyE'),
        pulse: pressed('KeyF', 'ShiftLeft', 'ShiftRight'),
      };
      latched.clear();
      return input;
    },
  };
}
