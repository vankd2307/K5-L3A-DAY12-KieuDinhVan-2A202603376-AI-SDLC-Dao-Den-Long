# Bằng chứng Phase 1

Máy chạy: Windows 11, Node 22.21.0. Mọi kết quả dưới đây chạy lại được ở tag `phase-1`.

## Bảng yêu cầu → bằng chứng

| # | Yêu cầu (PRD-0 / Contract) | Cách kiểm chứng | Kết quả |
|---|---|---|---|
| 1 | `game.contract.json` đúng mẫu, tuning khớp với code | `tests/contract.test.ts`: so sánh `tuning` với `TUNING` trong code | Đạt |
| 2 | Mô hình tick: snapshot tick 0 trước input, `--ticks N` chạy đúng N bước, sự kiện ghi tick k+1 | `tests/contract.test.ts`, `tests/rules.test.ts` | Đạt |
| 3 | Di chuyển theo `move` + `cam_yaw_deg`, chuẩn hóa vector, giữ giá trị cũ | `rules.test.ts > movement` | Đạt |
| 4 | Nhặt đom đóm trong `pickup_radius`, tối đa `carry_capacity` | `rules.test.ts > motes and lanterns` | Đạt |
| 5 | Nạp đèn (chỉ khi interact chuyển false→true), thắp khi đủ `lantern_cost` | như trên | Đạt |
| 6 | Bóng Mực đuổi theo, chạm thì mất lửa, rơi đom đóm, bất tử `invuln_s` | `rules.test.ts > shades and pulse` | Đạt |
| 7 | Tỏa sáng: tốn ánh sáng, làm choáng `pulse_stun_s`, đẩy `pulse_push_m`, có cooldown | như trên | Đạt |
| 8 | Bóng Mực không vào được `safe_radius` quanh đèn | test mô phỏng 600 tick, kiểm tra mọi snapshot | Đạt |
| 9 | Thắng `all_lit`, thua `no_flames`, thua `dawn` | test + các lần chạy CLI bên dưới | Đạt |
| 10 | Scenario không phát sự kiện, không cộng điểm | `rules.test.ts` | Đạt |
| 11 | Tất định: cùng seed và inputs → cùng output | test + `cmp` hai file 20000 tick | Đạt (giống hệt từng byte) |
| 12 | Sai định dạng → exit 2 + stderr | `tests/cli.test.ts`, chạy qua đúng `headless_cmd` | Đạt |
| 13 | Chơi được Đêm 1 từ đầu tới thắng/thua | bot tự chơi + chạy lại qua CLI (bên dưới) | Đạt (headless) |
| 14 | Bản 3D: nhân vật, camera, HUD, đèn sáng dần, chơi lại | chơi tay trên trình duyệt | **Chưa có ảnh**: chờ chụp màn hình |

## Test tự động

`npm test` → **37/37 đạt** (vitest 5.1).

Để chắc test không phải lúc nào cũng đạt, tôi cố tình làm hỏng code rồi chạy lại test:
- Bỏ đoạn đẩy Bóng Mực ra khỏi `safe_radius` → 2 test đỏ.
- Bỏ cooldown của tỏa sáng → 1 test đỏ.

Sau đó code được trả về nguyên trạng.

## Chạy headless thật

**Thắng.** Bot (`scripts/autoplay.ts`) chơi bằng class `Game` thật và ghi lại file inputs. Sau đó chạy lại file đó bằng đúng `headless_cmd`:

```
node --import tsx src/headless/cli.ts --seed 1 --night 1 --inputs docs/proof/phase-1/autoplay-seed1.inputs.json --ticks 20000 --out docs/proof/phase-1/autoplay-seed1.out.jsonl
```

| seed | kết quả | tick | điểm |
|---|---|---|---|
| 1 | won / all_lit | 2969 | 1215 |
| 2 | won / all_lit | 2849 | 1287 |
| 3 | won / all_lit | 3155 | 1352 |
| 4 | won / all_lit | 2469 | 1213 |
| 5 | won / all_lit | 3141 | 1287 |

Kết quả chạy lại bằng CLI khớp đúng với kết quả bot báo. Repo chỉ giữ file của seed 1: [autoplay-seed1.inputs.json](autoplay-seed1.inputs.json), [autoplay-seed1.out.jsonl](autoplay-seed1.out.jsonl).

**Thua do hết lửa.** Người chơi đứng yên, seed 1: bị chạm 3 lần, `game_over lost/no_flames` ở tick 716 ([idle-seed1.out.jsonl](idle-seed1.out.jsonl)).

**Thua do trời sáng.** Đảo không có Bóng Mực ([dawn.scenario.json](dawn.scenario.json)): `game_over lost/dawn` đúng tick 18000 = 300 s × 60 ([dawn.out.jsonl](dawn.out.jsonl)).

**Tất định.** Chạy hai lần `--seed 1 --ticks 20000`, so bằng `cmp` → hai file giống hệt.

**Tốc độ.** 18000 tick (cả đêm 5 phút) chạy hết 326 ms, tính cả thời gian khởi động node + tsx.

## Chưa đạt / chưa kiểm
- Bản 3D trên trình duyệt chưa có ảnh chụp: build thành công nhưng chưa chơi tay để xác nhận bằng mắt.
