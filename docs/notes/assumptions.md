# Giả định

## Phase 1 (PRD-0, Test Contract v1.0)

### Kiến trúc
- Luật game nằm trong `src/core/`: TypeScript thuần, không DOM/three/Node, 60 tick/giây cố định, số ngẫu nhiên lấy từ RNG có seed (mulberry32). Có hai lớp chặn: `tsconfig.core.json` và một test kiểm tra import.
- Bản web và CLI headless cùng dùng class `Game`.

### Con số tuning (khai trong `game.contract.json`, có test bắt buộc khớp với code)
| Khóa | Giá trị | Lý do |
|---|---|---|
| player_speed | 6 m/s | Nhanh hơn Bóng Mực (4) để chạy thoát được |
| carry_capacity | 10 | Đủ cho 2 đèn mỗi chuyến |
| lantern_cost | 5 | 5 đèn × 5 = 25 đom đóm; đảo có 30 con, mất đi sẽ hồi lại |
| pickup_radius | 1.2 m | |
| interact_radius | 2.5 m | Nhỏ hơn safe_radius, nên khi đứng nạp đèn thì không bị chạm |
| pulse_cost / radius / cooldown | 2 đom đóm / 6 m / 1 s | "Tỏa sáng tốn ánh sáng" |
| pulse_stun_s / pulse_push_m | 3 s / 4 m | |
| night1_duration_s | 300 | |
| flames / invuln_s / hit_drop_ratio | 3 / 2 s / 0.5 | dropped = floor(carried × 0.5) |
| safe_radius | 5 m | |
| shade_speed / shade_hit_radius | 4 m/s / 1 m | |
| fall_enabled | false | Mép đảo (bán kính 40 m) là tường mềm |

### Chỗ PRD/contract mơ hồ và cách tôi chọn
1. **Vùng an toàn áp dụng cho mọi đèn, kể cả đèn chưa thắp.** Contract ghi "bán kính quanh đèn", không nói đèn phải đã thắp. Khi đi hoặc bị đẩy vào vùng này, Bóng Mực bị đẩy ra đúng mép vòng tròn.
2. **Đom đóm rơi khi bị chạm thì mất hẳn**, không rơi xuống đất. `motes_active` không tăng.
3. **Tỏa sáng** chỉ có tác dụng khi hết cooldown và đang mang ≥ `pulse_cost`; nếu không thì không có gì xảy ra và không phát sự kiện. Khi có tác dụng thì luôn phát `pulse`, kể cả khi `stunned_ids` rỗng. Bóng Mực đang choáng mà nằm trong bán kính thì bị choáng lại và vẫn được cộng điểm.
4. **Nạp đèn**: chọn đèn chưa thắp gần nhất trong `interact_radius`. Số nạp = min(đang mang, số còn thiếu); phần dư vẫn giữ trên người.
5. **Bóng Mực luôn đuổi** (trạng thái `chase`), đi thẳng về phía người chơi trên mặt phẳng XZ. Tâm luôn ở Y = 1. Bóng Mực đang choáng thì đứng yên và không gây sát thương.
6. **Mỗi tick bị chạm tối đa một lần.** Thời gian bất tử tính bằng tick: `invuln_s × 60`.
7. **Thứ tự trong một bước**: đếm ngược bộ đếm → di chuyển và nhảy → nhặt → nạp (có thể thắng ngay) → tỏa sáng → Bóng Mực di chuyển → kiểm tra chạm → sinh thêm → kiểm tra bình minh.
8. **Sinh ngẫu nhiên** (khi `random_*` là true): ban đầu 30 đom đóm, mỗi 2 s thêm 1 con nếu còn dưới 30. Ban đầu có 2 Bóng Mực (S1, S2), cứ 40 s thêm 1 con, tối đa 5. Thực thể dựng sẵn ban đầu không phát `shade_spawned`.
9. **Scenario**: nếu `random_motes: false` mà không có `motes` thì đảo không có đom đóm (Bóng Mực cũng vậy). Nếu có danh sách thì danh sách đó thay thế danh sách mặc định, còn việc sinh ngẫu nhiên vẫn theo cờ. Lantern id không tồn tại → exit 2.
10. **Inputs**: `move` có thành phần ngoài [-1, 1] được coi là sai định dạng (exit 2). Nhận cả định dạng JSON `{frames}` lẫn JSONL.
11. **Điểm thưởng cuối màn** chỉ tính khi thắng: floor(time_left_s) × per_second_left + lửa còn lại × per_flame_left.
12. **Snapshot**: mặc định mỗi 60 tick, và luôn có snapshot ở tick cuối trước dòng `end`.
13. **Vị trí 5 đèn**: trên vòng tròn bán kính 25 m, L1 ở (0, 0, 25), các đèn sau cách nhau 72°. Người chơi xuất phát ở (0, 0, 0).
14. **Nhảy**: vận tốc ban đầu 6 m/s, trọng lực 20 m/s². Khoảng cách luôn đo theo XZ, nên lúc đang nhảy vẫn nhặt được đom đóm.
