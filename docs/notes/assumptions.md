# Giả định

## Phase 4 (v1.0.0, Test Contract v1.3)

Quyết định thiết kế: [ADR 0002](../adr/0002-bench-soak-leaderboard.md). Những chỗ đề chưa nói rõ và cách tôi chọn:
1. **Cảnh bench, "Bóng Mực vẫn di chuyển theo luật `wander`"**: Mây đứng yên ở (0,0,0). Nếu giữ luật thường thì những con trong vòng 12 m sẽ chuyển sang `chase`. Tôi cho Bóng Mực bỏ qua Mây trong cảnh bench, để cả 200 con luôn `wander` đúng như đề. `wander` theo luật Ticket-03 nghĩa là đi về đèn tắt gần nhất (L4, L5), vì không có đèn nào yếu (dầu luôn 100).
2. **"Rải đều trên đảo"**: phân bố đều theo diện tích trong bán kính 39 m (đảo 40 m), dùng RNG seed 42. Bóng Mực không đặt trong vùng an toàn 6 m của L1–L3 (đặt vào thì luật cũng đẩy ra ngay). Đom đóm có thể nằm bất kỳ đâu.
3. **"Hiệu ứng sáng tạo phải tắt trong bench"**: rung camera và lá bay không bao giờ chạy trong bench (không ai bị đánh, Đêm 1 không có gió). Cây, mây, sao vẫn giữ vì đó là cảnh nền "như lúc chơi thật". Gộp lại chỉ còn 3 draw call nên gần như không ảnh hưởng số đo. HUD vẫn hiện như lúc chơi.
4. **Đồng hồ trong bench** vẫn đếm ngược trên HUD nhưng không kết thúc Đêm (đề tắt điều kiện kết thúc).
5. **`load_ms`** tính từ lúc tiến trình `node scripts/bench.ts` khởi động. Không tính bước `vite build` chạy trước đó trong `npm run bench`, vì build không phải là "tải game".
6. **`peak_mem_mb`** = tổng RSS cả cây tiến trình Chrome mà bench mở, không chỉ tiến trình renderer. Đây là bộ nhớ thật mà game chiếm trên máy.
7. **Soak "Đêm thứ i dùng seed 7 + i"**: i đếm từ 1, nên Đêm đầu dùng seed 8 và Đêm cuối seed 17. "Input ngẫu nhiên theo seed" dùng một RNG riêng (seed của Đêm `xor` 0x5EED5EED), không lấy từ RNG của `Game`, để không làm lệch luật. Hướng di chuyển là một vector đơn vị có góc ngẫu nhiên; camera giữ yaw 0. Mỗi nút được bấm (true) đúng tick trúng xác suất, còn lại thả ra.
8. **"Hết thời lượng chuẩn"**: chạy tối đa `durationS × 60` tick mỗi Đêm. Đêm luôn kết thúc ở tick cuối, nên kết quả chỉ là `won` hoặc `lost`.
9. **Bảng xếp hạng, `score`**: tổng điểm các Đêm đã thắng trong một lượt chơi (bấm Bắt đầu = lượt mới). Thua rồi chơi lại thì vẫn cùng lượt. `seed` là seed của lượt; seed từng Đêm suy ra từ đó (`seed + 1000 × Đêm + số lần thử`).
10. **Tên tiếng Việt (điểm cộng)**: chấp nhận mọi chữ cái hệ Latin (gồm đủ dấu tiếng Việt) sau khi chuẩn hóa NFC. Độ dài 3–12 tính theo ký tự, nên "Mây" là 3. Không nhận khoảng trắng hay ký tự hệ chữ khác.
11. **Một người lưu nhiều lần**: mỗi lần lưu là một mục riêng. Một màn kết quả chỉ cho lưu một lần. Hai mục trùng hoàn toàn (tên, điểm, thời điểm tới từng giây) được coi là một khi gộp `localStorage` với file.
12. **Đổi phím**: mỗi hành động một phím. Phím đang dùng cho hành động khác thì **bị từ chối** (không tự đổi chỗ) và báo tên hành động đó. Esc dùng để hủy khi đang chờ nhấn phím, trừ khi đang gán cho chính Tạm dừng.
13. **Giảm chuyển động** tắt rung camera, lớp chớp tím khi trúng đòn, nhấp nháy đồng hồ ≤ 30 s và nhấp nháy của Mây khi bất tử. Thanh dầu nhấp nháy 1 Hz của đèn yếu **vẫn giữ**, vì Ticket-03 bắt buộc và phụ đề cũng báo việc đó.

## Phase 3 (Ticket-03 "Đèn cạn dầu", Test Contract v1.2)

Quyết định thiết kế chính: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Thay đổi phá vỡ tương thích: [CHANGELOG](../../CHANGELOG.md).

Ticket-03 **thay** giả định Phase 2 mục 2 (`wander` lượn ngẫu nhiên). Những chỗ ticket chưa quy định và cách tôi chọn:
1. **`wander` khi không có đèn yếu** đi về đèn tắt gần nhất tới khi cách 3 m, rồi lượn ngẫu nhiên quanh đó. Khi không có đèn tắt nào thì lượn ngẫu nhiên như trước. Phát hiện Mây ở 12 m vẫn ưu tiên chuyển sang `chase`.
2. **Bóng Mực `drain`** đứng yên, không gây sát thương (chỉ `chase`/`wander` mới gây). Bị Tỏa Sáng thì bỏ mục tiêu đèn.
3. **`fuel_drain`** phát theo từng con, mỗi 60 tick kể từ lúc con đó bắt đầu hút; `fuel` trong sự kiện làm tròn 1 chữ số thập phân.
4. **Khóa điểm mới** nằm trong `tuning.score` (`per_relight`, `per_stun_drain`, `per_lantern_at_dawn`); `per_second_left = 0` vì thưởng thời gian bị bỏ.
5. **Scenario**: đèn `lit: true` không ghi `ever_lit` thì coi là `ever_lit: true`; `fuel` của đèn tắt bị bỏ qua (luôn 0). `fuel` ngoài [0, 100] → exit 2. `target_lantern_id` không tồn tại → exit 2.
6. **Hình dạng đèn tắt** (xẹp 20%, giấy rách) và nhấp nháy khi dầu thấp **luôn bật**, không chỉ trong chế độ mù màu, vì chúng không làm hỏng gì. Chế độ mù màu chỉ đổi màu viền/mắt Bóng Mực và màu cảnh báo (đồng hồ ≤ 30 s chuyển trắng kèm ⚠).
7. **`end.score` khi thua** vẫn là điểm đã tích được trong đêm (như Phase 2), không có thưởng bình minh.

## Phase 2 (Ticket-02, Test Contract v1.1)

Ticket-02 **thay toàn bộ** số tự chọn ở Phase 1 bằng số chuẩn (xem `src/core/tuning.ts`, `src/core/maps.ts`). Những giả định Phase 1 bị ticket thay thế: vùng an toàn cho cả đèn chưa thắp (nay chỉ đèn đã sáng), đom đóm rơi mất hẳn (nay rơi ra đất 480 tick), điểm cộng khi nhặt (nay cộng khi nạp), mép đảo là tường (nay rơi xuống biển mây).

Những chỗ Ticket-02 chưa quy định và cách tôi chọn:
1. **Tăng tốc/dừng**: tức thời (0 s ≤ 0.1 s). Nhờ vậy vị trí tính được chính xác theo tick.
2. **Bóng Mực `spawning`** kéo dài 60 tick, trong lúc đó không di chuyển, không gây sát thương. Sau đó chuyển `wander` (lượn 1.5 m/s tới điểm ngẫu nhiên trong 8 m). Bóng Mực trong scenario mặc định là `wander` ("hoạt động bình thường ngay"), nên nếu người chơi cách ≤ 12 m thì đuổi luôn từ tick đầu.
3. **Chênh cao khi chạm** tính bằng `|shade.pos.y − player.pos.y| ≤ 1.5` (tâm Bóng Mực cao hơn mặt đất 1 m). Gió Lạc chỉ xét XZ ≤ 1.2 như ticket ghi.
4. **Bóng Mực di chuyển** chỉ trên đất liền (đảo, cầu) và không xuyên tháp. Ở Đêm 3 Bóng Mực bay theo độ cao địa hình (+1 m), không bị vách chặn. Bóng Mực trong trạng thái `chase` hoặc `wander` mới gây sát thương; `recoil`, `stunned`, `spawning` và đang bị đẩy khỏi vùng an toàn thì không.
5. **Đẩy khỏi vùng an toàn**: tuyến tính, đúng 30 tick, ra tới mép 6 m.
6. **Lịch sinh Bóng Mực**: điểm hợp lệ là điểm cách người chơi ≥ 15 m; chọn ngẫu nhiên theo seed trong số đó. Tối đa tính trên tổng số Bóng Mực (chúng không chết).
7. **Trần 30 đom đóm** tính cả đom đóm rơi. "Điểm trống" là điểm sinh chưa có đom đóm ngẫu nhiên nào.
8. **Gió Lạc** sinh ở các điểm sinh Bóng Mực ("điểm sương" chưa định nghĩa), bay 1.5 m trên mặt đất, không bị đất liền giới hạn. Đồ cướp được thả "tại chỗ" trong bán kính 0.6 m; rơi xuống biển thì mất. Bị Tỏa Sáng lúc `chase` thì `flee` 240 tick. Tối đa 2 con tính trên số con chưa `removed`.
9. **Gió mạnh**: cơn gió bắt đầu ở sim tick 1800k, kéo dài 300 tick, hướng ngẫu nhiên theo seed. `dir_deg` đo như góc bản đồ (từ +X ngược chiều kim đồng hồ: x = cos, z = sin); snapshot cho `null` khi không có gió.
10. **Điểm xuất phát Đêm 3** là (0, 0, −30). Ticket không nêu, mà (0, 0, 0) lại nằm trong tháp chuông. Đêm 2 xuất phát ở (0, 0, 0) trên đảo A.
11. **Lướt**: hướng là vận tốc ngang hiện tại (kể cả khi đang bay từ bục nhảy), nếu đứng yên thì theo hướng mặt. Đang lướt thì không nhảy. Hết lướt mà vẫn đang bay từ bục thì giữ tiếp vận tốc bục.
12. **Bục nhảy** kích hoạt khi chân đứng trên mặt bục (XZ ≤ 1 m, cùng độ cao). Hướng ngang cố định từ tâm bục tới tâm đảo kia.
13. **Vách và dốc**: bước được lên bậc cao ≤ 0.35 m (dốc mỗi tick chỉ tăng ≤ 0.12 m), cao hơn thì bị chặn. Đi ra mép cao hơn 0.35 m thì rơi xuống.
14. **Snapshot**: `invuln` là boolean; `*_s` là số giây còn lại (làm tròn 3 chữ số); `ttl_s` của đom đóm ngẫu nhiên là `null`. Thứ tự sự kiện trong output: `night_start` ở tick 0, ngay sau snapshot đầu.
15. **Điểm khi thua**: `end.score` vẫn ghi điểm đã tích được trong đêm (nạp đèn, Tỏa Sáng), không có thưởng cuối màn. Trong game, tổng điểm chỉ cộng các Đêm thắng.
16. **Tạm dừng**: trong lúc dừng vẫn theo dõi trạng thái nút, nên nút giữ từ trước không kích hoạt lại khi tiếp tục. Tick bỏ tạm dừng chạy mô phỏng bình thường.

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
