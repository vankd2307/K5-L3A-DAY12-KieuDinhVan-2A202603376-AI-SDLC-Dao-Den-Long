# Retro: Đảo Đèn Lồng (Day 12, AI SDLC)

Bốn phase, một game 3D chạy trên web, luật nằm hoàn toàn trong `src/core` (TypeScript thuần, tất định) và được bao bởi Test Contract v1.0 → v1.3. Công cụ: Claude Code (Opus) trong VS Code. Nhật ký chi tiết: [ai-log.md](ai-log.md).

## 1. Đánh giá từng phase

| Phase | Đạt | Có làm hỏng phase trước? | Còn phải chỉnh |
|---|---|---|---|
| 1 · PRD-0, Contract v1.0 | Đêm 1 chơi được, CLI headless, 37/37 test, bot thắng được | — | Số tuning tự chọn, Phase 2 thay toàn bộ |
| 2 · Ticket-02, v1.1 | 3 đêm, số và bản đồ chuẩn, 12 bước tick, menu/tạm dừng/cài đặt/âm thanh/HUD, 63/63 test | Có, theo chủ đích: số Phase 1 bị thay. Ghi trong bằng chứng | Bot chỉ thắng Đêm 1 (0/5 ở Đêm 2–3) |
| 3 · Ticket-03, v1.2 | Dầu đèn, `drain`, thắng lúc bình minh, sức chứa, điểm mới, chế độ mù màu, 84/84 test | Có 5 test cũ đỏ đúng như dự kiến, đều được sửa hoặc xóa kèm lý do (mục "Hồi quy") | Như Phase 2 |
| 4 · v1.0.0, v1.3 | Bench (135 fps / 1% low 44.5 trên GPU tích hợp), soak (0 crash, RAM ×1.09), bảng xếp hạng lưu file, đổi phím, phụ đề, giảm chuyển động, chữ ≥ 18 px, 104/104 test | **Không**: đầu ra headless giống từng byte với Phase 3 (có test). 4 test cũ đỏ chỉ vì đổi contract/cài đặt | Release + video phải làm trên GitHub; chưa chơi thử tay phần đổi phím |

## 2. Những lần AI sai và cách phát hiện

| Loại sai | Ví dụ | Phát hiện bằng | Harness thêm vào để không lặp lại |
|---|---|---|---|
| **Test giả / kỳ vọng sai** | Phase 2: 3 test kỳ vọng sai (hồi chiêu, làm tròn), 1 kịch bản vô lý. Phase 3: quên lượng dầu bị hút trong cùng tick | Đọc thông báo lỗi, đối chiếu với ticket | CLAUDE.md: "test đỏ thì kiểm kỳ vọng của test trước, không sửa luật cho khớp test" |
| **Sửa sai chỗ** | Phase 4: hai lần tối ưu sai chỗ (draw call, shader) trước khi đo | Số bench không cải thiện; thêm đo từng phần và chạy thử bỏ từng thứ | Ghi vào ai-log: đo trước, tối ưu sau. Bench giờ in thời gian sim/render/HUD |
| **Lệnh phá hủy** | Phase 4: định khôi phục file bằng `git checkout --`, việc này sẽ xóa thay đổi chưa commit | Bộ phân loại quyền của Claude Code chặn lại | Sao lưu vào thư mục tạm rồi `cmp` |
| **Nghi sai nguyên nhân** | Phase 4: gỡ lỗi Chrome "tự thoát", hóa ra người dùng đóng cửa sổ | Mã thoát 0 (thoát bình thường) | Hỏi người dùng sớm khi có tác động từ bên ngoài |
| **Công cụ / môi trường** | Heredoc bash và Python escape làm hỏng `\n` trong TypeScript (Phase 3 và 4) | `npm run typecheck` | CLAUDE.md: script sửa file ghi ra file `.py` riêng |
| **Bằng chứng sai** | Ảnh "thua" chụp trước khi game kết thúc (P3); ảnh phụ đề với virtual time (P4) | Tự xem lại ảnh | verify-phase: luôn mở ảnh ra xem, ghi "chưa kiểm" khi chưa chạy |

## 3. Cái gì hiệu quả, cái gì không

**Hiệu quả**
- **Tách core thuần + contract headless ngay từ Phase 1.** Mọi ticket sau chỉ sửa `src/core`, và test chạy trong vài giây không cần trình duyệt. Phase 4 thêm benchmark mà vẫn chứng minh được đầu ra không đổi bằng một test so byte.
- **Quy trình ticket đổi luật** (ADR → CHANGELOG → chạy test *trước* khi sửa test → bảng "Hồi quy"): biết chính xác test nào hỏng vì luật mới, không phải đoán.
- **Cố tình làm hỏng code** để chứng minh test có thể đỏ (mỗi phase một lần).
- **Skill `verify-phase`** gói checklist kiểm chứng; ảnh chụp bằng Chrome headless không cần người.

**Không hiệu quả**
- Bot tự chơi: tốn nhiều lượt chỉnh mà vẫn chỉ thắng được Đêm 1.
- Một hội thoại dài xuyên nhiều phase: trang usage cho thấy khoảng 71% mức dùng trong ngày đến từ ngữ cảnh lớn bị gửi lại mỗi lượt.

## 4. Harness giúp nhiều nhất
1. **CLAUDE.md**: ngắn, toàn quy tắc rút ra từ lỗi thật (số chỉ ở `tuning.ts`, dùng helper của `Game` cho ngưỡng, 12 bước tick, kiểm kỳ vọng test trước, chạy test trước khi sửa test).
2. **Test Contract + `tests/contract.test.ts`**: `game.contract.json` phải khớp với `TUNING`, không thể "quên" cập nhật.
3. **Skill verify-phase**: mỗi lần tag đều làm đủ các bước kiểm chứng.
4. `tsconfig.core.json`: chặn DOM/three/Node lọt vào core ở mức trình biên dịch.

## 5. Token và chi phí
- Gói Claude Pro, không có số token theo phase; chỉ có % hạn mức (xem [ai-log.md](ai-log.md)). Sau Phase 0–2: 37% phiên 5 giờ, 31% tuần.
- Phase 3–4: _(điền % hạn mức từ trang /usage)_. Ước tính tổng: _(điền)_.
- Cách tiết kiệm: đề bài và giả định nằm trong file nên không phải dán lại; chỉ đọc tài liệu lab khi cần; bằng chứng do script sinh ra; dùng `grep`/đọc từng đoạn thay vì đọc cả file lớn; một agent duy nhất, không chạy subagent song song.

## 6. Nếu làm lại
- `/clear` giữa các phase: mọi thứ cần thiết đã nằm trong file nên không mất gì, mà đỡ tốn nhiều token.
- Đặt **ngân sách hiệu năng và profiler từ Phase 2** (cảnh nhiều Bóng Mực), thay vì phát hiện HUD gây giật ở Phase 4.
- HUD viết theo kiểu "chỉ cập nhật khi đổi" ngay từ đầu.
- Bỏ bớt công sức cho bot, dành cho test kịch bản dựng sẵn bằng scenario (rẻ và chắc hơn).
- Hỏi người dùng ngay khi thấy hành vi lạ từ bên ngoài (cửa sổ tự đóng) thay vì gỡ lỗi mò.
