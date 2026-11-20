# Spec Phase 2 (Ticket-02 · Ba hòn đảo · Contract v1.1)

Nguồn: [docs/requirements/phase-2.md](../requirements/phase-2.md). Số liệu chuẩn nằm ở `src/core/tuning.ts`, bản đồ chuẩn ở `src/core/maps.ts`.

## Acceptance criteria

### Phần 1–2: số liệu, bản đồ, thứ tự tick (kiểm bằng test headless)
| # | Tiêu chí | Kiểm chứng |
|---|---|---|
| P1 | `game.contract.json` v1.1: `tuning` bằng đúng số chuẩn, có thêm dash_* và night2/3_duration_s | test so sánh với code và với bảng số chuẩn |
| P2 | Chạy 6 m/s (7.2 m/s khi có bùa); nhảy 7 m/s, g = 20, chỉ nhảy khi chạm đất | test |
| P3 | Lướt 14 m/s × 12 tick, hồi chiêu 90 tick tính từ lúc bắt đầu; trên không giữ nguyên độ cao; sự kiện `dash` | test |
| P4 | Nhặt khi XZ ≤ 1.0 và chênh cao ≤ 1.5; sức chứa 10; 20 đom đóm ban đầu ở 20 điểm khác nhau; sinh thêm ở tick 240k nếu còn dưới 30 | test |
| P5 | Đèn cần 10, nạp nhiều lần, bán kính 2.0, nếu bằng khoảng cách thì chọn id nhỏ hơn; +10 mỗi đom đóm nạp, +100 mỗi đèn | test |
| P6 | Chỉ đèn đã sáng có vùng an toàn 6 m; Bóng Mực đang ở trong bị đẩy ra trong 30 tick và không gây sát thương lúc đó | test |
| P7 | Tỏa Sáng: tốn 3, bán kính 3D 5 m tính từ chân + 0.8, hồi chiêu 180 tick; choáng 120 tick; đẩy 4 m trong 15 tick; +5 mỗi con trúng | test |
| P8 | Bóng Mực: các trạng thái `spawning/wander/chase/recoil/stunned`; phát hiện 12 m, bỏ đuổi 18 m; sinh theo lịch 300 + k·khoảng; id S1, S2… | test |
| P9 | Bị đánh: −1 lửa, rơi floor(n/2) đom đóm ra vành 1.5–2.5 m (sống 480 tick, nhặt được từ tick sau), bất tử 90 tick, Bóng Mực `recoil` 2 m/60 tick; tối đa 1 hit mỗi tick | test |
| P10 | Rơi khỏi đảo (Y < −10): −1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh ở điểm xuất phát, bất tử 90 tick; `player_hit {by: fall, lost}` | test |
| P11 | Thắng/thua xét cuối tick: hết lửa → thua; đủ đèn → thắng (kể cả đúng tick hết giờ); hết giờ → `dawn` | test |
| P12 | Đêm 2: cầu tre, bục nhảy 14/24 m/s → đáp ở đảo kia; Đêm 3: 3 tầng, vách, dốc, bục (0,3,13) → tầng 2, tháp chặn | test |
| P13 | Gió Lạc (Đêm 2–3): idle → chase (mang ≥ 5, ≤ 15 m) → cướp min(3, n) → flee 240 tick → removed; Tỏa Sáng làm chase → flee, hoặc làm flee thả lại đồ đã cướp | test |
| P14 | Bùa Gió: hiệu lực 600 tick, lướt không hồi chiêu, xuất hiện lại sau 2700 tick | test |
| P15 | Gió mạnh Đêm 3: mỗi 1800 tick có cơn gió 300 tick, đẩy 2 m/s | test |
| P16 | Tạm dừng: `tick` tăng, `sim_tick` và mọi bộ đếm đứng yên, snapshot `paused`, có sự kiện `paused/resumed` | test |
| P17 | Snapshot và scenario có đủ trường v1.1; `--night 1/2/3` | test |
| P18 | Một Đêm đầy đủ 21 600 tick chạy ≤ 30 s | đo |

### Phần 3: tính năng (kiểm bằng chơi tay + ảnh/video)
| # | Tiêu chí nghiệm thu |
|---|---|
| F1 Gió Lạc | Thấy dải lụa xám xanh (#8FA3B8) bay đến khi mang ≥ 5 đom đóm; chạm thì HUD giảm tối đa 3 đom đóm; dải lụa bay đi rồi biến mất |
| F2 Bùa Gió | Lá bùa đỏ (#C8102E) viền vàng xoay tại vị trí chuẩn; nhặt thì HUD hiện thời gian bùa, chạy nhanh hơn, Lướt liên tục được; lá bùa biến mất rồi xuất hiện lại |
| F3 Chuỗi 3 Đêm | Menu → giới thiệu Đêm (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp; thắng Đêm 3 hiện màn Bình Minh với tổng điểm; thua thì có nút chơi lại Đêm đó |
| F4 Tạm dừng | Esc/P dừng hẳn logic (đồng hồ đứng yên); menu có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| F5 Cài đặt | Thanh âm lượng và độ nhạy chuột; tải lại trang vẫn giữ (localStorage) |
| F6 Âm thanh | Nhạc nền đêm và hiệu ứng cho nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối (tổng hợp bằng WebAudio, không dùng file ngoài) |
| F7 HUD | Lửa ở trên trái; `mm:ss` ở trên giữa, đỏ và nhấp nháy khi ≤ 30 s; `k/n` đèn và điểm ở trên phải; thanh 10 ô ở dưới giữa; icon hồi chiêu Lướt/Tỏa Sáng ở dưới phải; dòng "E — Nạp ánh sáng (x/10)"; mũi tên chỉ đèn chưa sáng khi đèn ở ngoài màn hình |
| F8 Màu | Các thành phần trong bảng dùng đúng mã hex; ánh sáng môi trường = 0.15 + 0.55 × tỉ lệ đèn sáng |

## Giả định cho chỗ Ticket-02 chưa quy định
Xem [assumptions.md](assumptions.md), mục Phase 2.
