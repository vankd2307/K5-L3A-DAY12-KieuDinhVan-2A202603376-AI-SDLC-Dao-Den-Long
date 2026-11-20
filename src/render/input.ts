import type { TickInput } from '../core';

/** Maps keyboard (WASD / arrows) to engine-agnostic TickInput. */
export function createKeyboardInput(): () => TickInput {
  const down = new Set<string>();
  window.addEventListener('keydown', (e) => down.add(e.code));
  window.addEventListener('keyup', (e) => down.delete(e.code));
  const has = (...codes: string[]) => codes.some((c) => down.has(c));
  return () => ({
    moveX: (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0),
    moveZ: (has('KeyS', 'ArrowDown') ? 1 : 0) - (has('KeyW', 'ArrowUp') ? 1 : 0),
  });
}
