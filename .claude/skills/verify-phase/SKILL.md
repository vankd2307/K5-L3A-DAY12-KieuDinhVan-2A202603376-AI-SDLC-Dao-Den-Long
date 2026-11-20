---
name: verify-phase
description: Run the full verification for a phase of Dao Den Long (typecheck, tests, headless contract runs, perf, screenshots) and record evidence in docs/proof/phase-N/. Use before tagging a phase or when asked to "kiểm chứng" / "verify".
---

# Verify a phase

1. `npm run typecheck` (also checks src/core has no DOM/three/Node) and `npm test`. Both must be green. Save the verbose list:
   `npx vitest run --reporter=verbose 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "✓|×|Tests|Test Files" > docs/proof/phase-N/test-output.txt`
2. Prove tests can fail: copy the file to the scratchpad first, break one rule in src/core, confirm a test goes red, restore from the copy and `cmp` it. Never `git checkout --` (it also drops uncommitted work).
3. Headless runs through the exact `headless_cmd` from game.contract.json:
   - determinism: same args twice -> `cmp` identical;
   - perf: longest night with `{"random_shades": false}` must finish well under the contract limit (record ms + CPU in perf.txt);
   - playable: `npm run autoplay -- <seed> <inputs.json> <night>`, then replay the inputs with the CLI and check `end`.
4. UI evidence without a human: `npm run build`, `npx vite preview --port 4179`, then
   `chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1400,800 --virtual-time-budget=3000 --screenshot=<png> "http://localhost:4179/?night=N"`;
   pass `--enable-logging=stderr --v=0` and grep for `Uncaught|TypeError`. Stop only the preview server you started.
5. Phase 4+: `npm run bench -- --seed 42 --duration 30 --out bench.json` (real Chrome window ~35 s: tell the user not to close it; stderr prints sim/render/hud ms per frame) and the `soak_cmd` from game.contract.json. Check thresholds (avg >= 60, 1% low >= 30, load <= 10000 ms; crashes 0, mem_end <= 1.2 x mem_start). Optimise only after measuring which part is slow.
   For screenshots that need game time to pass, `--virtual-time-budget` is not enough: capture over DevTools after N real seconds.
6. Write docs/proof/phase-N/README.md: one row per acceptance criterion (spec in docs/notes/), result `Đạt` / `Chưa đạt` / `Chưa kiểm` with the reason. Never mark something passed that was not run.
