# Changelog

## Phase 4 · v1.0.0 · Contract v1.3 (phát hành)

Không đổi luật chơi, số liệu hay bản đồ: đầu ra headless giống hệt Phase 3 (có test so từng byte với bằng chứng Phase 3).

### Thay đổi tương thích
- `game.contract.json`: `contract_version` **1.3**, thêm `bench_cmd` (`npm run bench --`) và `soak_cmd`. `run_cmd` đổi từ `npm run dev` thành **`npm start --`** (mở game, và nhận `--export-leaderboard out.json`).
- Phím điều khiển giờ là **một phím cho mỗi hành động** và đổi được. Bỏ phím phụ cũ: ↑/↓ để đi, Q để lướt, P để tạm dừng (có thể gán lại trong Cài đặt).
- `CHANGELOG.md` chuyển từ `docs/` ra gốc repo.

### Thêm mới
- **Benchmark** ([scripts/bench.ts](scripts/bench.ts)): cảnh chuẩn 200 Bóng Mực + 100 đom đóm, camera bay vòng, đo bằng Chrome thật 1280×720 không vsync, ghi `bench.json`. Không thêm dependency: điều khiển Chrome qua DevTools Protocol bằng `WebSocket` có sẵn của Node 22.
- **Soak test** ([src/headless/soak.ts](src/headless/soak.ts)): 10 Đêm trong một tiến trình, input ngẫu nhiên theo seed, ghi `soak.json`.
- `Game.bench` (mặc định `false`): tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm, Bóng Mực luôn `wander`.
- **Bảng xếp hạng** top 10: lưu sau Bình Minh hoặc sau khi thua; tên 3–12 ký tự, nhận cả tiếng Việt có dấu; lưu ra file trên đĩa (`~/.dao-den-long/leaderboard.json`), dự phòng `localStorage`; màn hình riêng từ menu.
- **Dễ tiếp cận**: đổi phím (báo trùng, khôi phục mặc định, được lưu); phụ đề/chỉ báo cho Bóng Mực xuất hiện (mũi tên tím), gió sắp nổi, 10 giây cuối, đèn dầu < 30; Giảm chuyển động; chữ tối thiểu 18 px, tùy chọn chữ lớn ×1.25.
- Rung camera nhẹ khi bị đánh (tắt được bằng Giảm chuyển động).
- `LICENSE`, `CREDITS.md`, ADR 0002.

### Hiệu năng (chỉ phần hiển thị)
- Bóng Mực và đom đóm vẽ bằng `InstancedMesh`. Cây, mây, ván cầu gộp thành một mesh mỗi loại. Vật liệu Lambert thay PBR. Kết quả: khoảng 35 draw call mỗi khung.
- HUD chỉ ghi DOM khi giá trị đổi. Đây là nguyên nhân chính gây giật: 1% low tăng từ 21 lên 44–55 fps.

## Phase 3 · Contract v1.2 (Ticket-03 "Đèn cạn dầu")

### Breaking changes
- **Luật thắng**: không còn thắng sớm khi thắp hết đèn. Đêm luôn chạy tới bình minh; thắng (`dawn_survived`) nếu còn Ngọn Lửa và số đèn đang sáng ≥ ceil(0.6 × tổng). `game_over.reason = "all_lit"` **bị bỏ**.
- **Thời lượng Đêm**: 300/330/360 s → **240/270/300 s** (`night*_duration_s`).
- **Đèn có thể tắt**: hao 1 fuel/s, hết dầu thì tắt (`lantern_out`), `deposited` về 0. Đèn đã sáng **nhận thêm** đom đóm (châm dầu), không còn bị bỏ qua khi tương tác.
- **Vùng an toàn** chỉ còn khi đèn sáng **và** `fuel >= 30`.
- **Bóng Mực `wander`** không lượn ngẫu nhiên nữa: đi về đèn yếu (`fuel < 30`) để hút dầu (trạng thái mới `drain`), không có thì về đèn tắt gần nhất.
- **Điểm**: +5/đom đóm nạp (trước +10); thắp lần đầu +100, thắp lại +40; Tỏa Sáng +5/con, +15 nếu con đó đang `drain`; khi thắng: mỗi đèn đang sáng +50 + floor(fuel), mỗi Ngọn Lửa +50. **Bỏ** thưởng thời gian (`per_second_left = 0`).
- **Sức chứa** không cố định 10: `min(20, 10 + 2 × successful_lights)`.
- `lantern_lit` thêm `relight`.

### Thêm mới
- `tuning`: `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`; trong `score`: `per_relight`, `per_stun_drain`, `per_lantern_at_dawn`.
- Snapshot: đèn có `fuel`, `ever_lit`, `relit_count`; `player.capacity`; Bóng Mực có trạng thái `drain`.
- Scenario: đèn nhận `fuel`, `ever_lit`; `player.successful_lights`; `shades[].target_lantern_id`.
- Sự kiện: `refuel`, `lantern_out`, `fuel_drain`.
- UI: thanh dầu trên đèn (nhấp nháy 1 Hz khi < 30), HUD `đang mang / sức chứa`, cài đặt "Bảng màu dễ phân biệt".

## Phase 2 · Contract v1.1 (Ticket-02 "Ba hòn đảo")
- Số liệu chuẩn thay số tự chọn; 3 Đêm với bản đồ chuẩn; Lướt, rơi khỏi đảo, Gió Lạc, Bùa Gió, gió mạnh, tạm dừng; snapshot/scenario/sự kiện v1.1.

## Phase 1 · Contract v1.0 (PRD-0)
- Đêm 1 chơi được, chế độ headless theo Test Contract v1.0.
