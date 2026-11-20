# ADR 0001: Đèn có nhiên liệu, thắng khi sống tới bình minh

- Trạng thái: Chấp nhận (Phase 3, Ticket-03, Contract v1.2)
- Thay thế: luật "đèn sáng là sáng mãi", "thắng ngay khi thắp hết đèn", "vùng an toàn của đèn sáng là tuyệt đối"

## Bối cảnh
Playtest: người chơi giỏi thắp hết đèn trong 2 phút rồi Đêm kết thúc. Ticket-03 đổi mục tiêu thành **giữ đảo sáng tới bình minh**: đèn hao dầu, có thể tắt và thắp lại, Bóng Mực hút dầu đèn yếu.

## Quyết định

### 1. Mô hình trạng thái đèn
Trước: `{ deposited, lit }`, một chiều `tắt → sáng`.
Sau: `{ deposited, lit, fuelUnits, everLit, relitCount }`. Vòng đời:

```
TẮT (chưa từng sáng) --nạp đủ 10--> SÁNG (fuel 100) --hao 1/s + hút 5/s mỗi Bóng Mực--> fuel <= 0
                                       ^   |  châm dầu: +10 fuel/đom đóm, tối đa 100            |
                                       |   +--------------------------------------------------+ v
                                       +--------------- nạp đủ 5 (thắp lại) --------- TẮT (everLit, deposited = 0)
```

- **Dầu lưu bằng số nguyên đơn vị 1/60** (`fuelUnits`, tối đa 6000). Hao 1 đơn vị/tick, mỗi Bóng Mực hút thêm 5 đơn vị/tick, mỗi đom đóm châm thêm 600 đơn vị. Không có sai số số thực; chỉ đổi ra `fuel` (1 chữ số thập phân) khi xuất snapshot. Ticket khuyến nghị cách này.
- **Hai ngưỡng suy ra từ `fuelUnits`**, không lưu thành cờ riêng: `lit && fuel >= 30` thì còn vùng an toàn; `lit && fuel < 30` là "đèn yếu", Bóng Mực có thể tới hút. Như vậy không có trạng thái thừa nào bị lệch.
- **Một hàm chọn đèn khi tương tác** (`lanternInReach`) xét "đèn nhận được" = chưa sáng, hoặc sáng nhưng chưa đầy. Hàm này dùng chung cho game, HUD và bot.
- Đèn tắt ngay sau bước 2 của tick (sau khi trừ dầu), theo thứ tự Ticket-03 quy định.

### 2. Bóng Mực có thêm trạng thái `drain`
`wander` → (tới đèn yếu ≤ 2 m) → `drain` → `chase` (Mây ≤ 6 m) / `stunned` (Tỏa Sáng) / `wander` (đèn tắt, được châm ≥ 30, hoặc xa > 2 m). Phần hút dầu nằm ở bước 2 cùng với hao dầu, nên cùng một bước tính mọi thay đổi dầu. Sự kiện `fuel_drain` ghi mỗi 60 tick hút của từng con.
Khi châm dầu vượt lên ≥ 30, dùng lại cơ chế "đẩy ra mép vùng trong 30 tick, không gây sát thương" đã có từ lúc thắp đèn (Ticket-02), không viết cơ chế thứ hai.

### 3. Luật thắng
Bỏ thắng sớm. `checkEnd()` cuối tick: hết Ngọn Lửa → thua `no_flames` (luôn trước); hết giờ → thắng `dawn_survived` nếu số đèn đang sáng ≥ `ceil(win_ratio × tổng)`, ngược lại thua `dawn`.

### 4. Sức chứa
`capacity = min(20, 10 + 2 × successfulLights)`, tính từ một bộ đếm trong `Player`. Thắp lại cũng tính; đèn đặt sẵn bằng scenario thì không.

## Hệ quả
- Mọi test về điểm, luật thắng và vùng an toàn của Phase 2 phải sửa (xem [CHANGELOG](../../CHANGELOG.md) và mục "Hồi quy" trong bằng chứng Phase 3).
- Bot tự chơi phải đổi mục tiêu: giữ đèn sáng và sống sót, thay vì thắp hết.
- Giả định Phase 2 mục 2 ("`wander` lượn ngẫu nhiên") bị Ticket-03 làm rõ: `wander` đi về đèn yếu, không có thì về đèn tắt gần nhất.
