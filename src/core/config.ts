import type { GameConfig } from './types';

// Every number here is an assumption until PRD-0 says otherwise; record changes in docs/notes/.
export const DEFAULT_CONFIG: GameConfig = {
  tickRate: 60,
  playerSpeed: 4,
};
