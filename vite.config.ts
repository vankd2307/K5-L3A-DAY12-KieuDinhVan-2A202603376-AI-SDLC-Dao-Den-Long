import { defineConfig } from 'vitest/config';
import { leaderboardMiddleware } from './src/node/leaderboard-file';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022' },
  plugins: [
    {
      // Phase 4 §3: the game saves its leaderboard to a file on disk through this local API
      name: 'leaderboard-file',
      configureServer: (server) => void server.middlewares.use(leaderboardMiddleware()),
      configurePreviewServer: (server) => void server.middlewares.use(leaderboardMiddleware()),
    },
  ],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
