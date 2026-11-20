# Dao Den Long - Day 12 AI SDLC

- De bai lab (khong commit): docs/lab/ - doc RUBRIC.md, SUBMISSION.md khi can, khong doc het moi lan.
- Yeu cau tung phase (PRD-0, Ticket-02..04): docs/requirements/phase-N.md
- Gia dinh, nhat ky AI, retro: docs/notes/ - Bang chung: docs/proof/
- Khong commit .env, API key, token.

## Code
- Luat game chi o src/core/ (TS thuan, khong DOM/three/Node, khong Math.random/Date). src/render/ chi DOC state.
- Moi so gameplay o src/core/tuning.ts (TUNING = so chuan ticket, OWN = so tu chon); ban do chuan o src/core/maps.ts. Doi so thi sua ca game.contract.json (test bat buoc khop).
- Game.step() theo dung 12 buoc thu tu tick cua Ticket-02; them luat moi thi dat dung buoc, khong chen lung tung.
- Goc ban do: tu +X nguoc chieu kim dong ho nhin tu tren => x = r cos a, z = r sin a.
- Ticket moi thay luat cu: sua test cu kem ly do trong docs/proof/phase-N/README.md (muc Hoi quy), khong tat test.
- Test do: kiem tra ky vong cua test truoc (AI tung viet sai ky vong 3 lan o Phase 2), khong sua luat cho khop test.
- Kiem chung truoc khi tag: dung skill .claude/skills/verify-phase.
- Dau den luu so nguyen 1/60 (Lantern.fuelUnits). Nguong dung helper cua Game (hasSafeZone, isWeak, accepts, lightCost, capacity, litNeeded), khong tinh lai o noi khac.
- Ticket thay luat: ghi ADR (docs/adr/) + CHANGELOG (docs/CHANGELOG.md), chay test TRUOC khi sua test de liet ke dung test bi anh huong.
- Script Python sua file: ghi ra file .py trong scratchpad roi chay (heredoc bash tren Windows hay loi parse).
- Lenh: `npm test` (vitest), `npm run typecheck`, `npm run dev`, headless = headless_cmd trong game.contract.json.
- Xong viec: chay `npm run typecheck && npm test`; cap nhat docs/proof/phase-N/README.md (yeu cau -> bang chung -> ket qua, ghi "chua dat" neu chua).
- Sang tao them (thuc the moi...) khong duoc doi output headless khi scenario tat random.
