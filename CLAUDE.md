# Dao Den Long - Day 12 AI SDLC

- De bai lab (khong commit): docs/lab/ - doc RUBRIC.md, SUBMISSION.md khi can, khong doc het moi lan.
- Yeu cau tung phase (PRD-0, Ticket-02..04): docs/requirements/phase-N.md
- Gia dinh, nhat ky AI, retro: docs/notes/ - Bang chung: docs/proof/
- Khong commit .env, API key, token.

## Code
- Luat game chi o src/core/ (TS thuan, khong DOM/three/Node, khong Math.random/Date). src/render/ chi DOC state.
- Moi so gameplay o src/core/tuning.ts; doi so thi sua ca game.contract.json (test bat buoc khop).
- Lenh: `npm test` (vitest), `npm run typecheck`, `npm run dev`, headless = headless_cmd trong game.contract.json.
- Xong viec: chay `npm run typecheck && npm test`; cap nhat docs/proof/phase-N/README.md (yeu cau -> bang chung -> ket qua, ghi "chua dat" neu chua).
- Sang tao them (thuc the moi...) khong duoc doi output headless khi scenario tat random.
