# Nhật ký dùng AI

Công cụ: Claude Code (model Opus) trong VS Code.

| Phase | Việc | Token/chi phí ước tính | AI sai ở đâu / cách phát hiện |
|---|---|---|---|
| 0 | Dựng khung TS + Three.js + Vite, tách core headless | _(điền theo /usage)_ | Heredoc bash lỗi parse trên Windows → chuyển sang dùng tool Write. `.gitignore` có BOM và đang bỏ qua `CLAUDE.md` (trái RULES §7) → AI phát hiện khi review và đã sửa |
| 1 | Đọc PRD-0; viết core theo Contract v1.0, CLI, 37 test, bot tự chơi, bản 3D | _(điền theo /usage)_ | Không đọc được lab board trực tiếp (artifact ngoài tài khoản); PDF in ra bị trắng → người dùng copy chữ vào `docs/requirements/phase-1.md`. Một lỗi typecheck (`noUncheckedIndexedAccess` trong scenario.ts), bắt được bằng `npm run typecheck` |
| 2 | Ticket-02: viết lại core theo số/bản đồ chuẩn và 12 bước tick, contract v1.1, 60 test, UI 3 đêm, menu, tạm dừng, cài đặt, âm thanh, HUD | _(điền theo /usage)_ | (1) **Test viết sai kỳ vọng 3 lần** (hồi chiêu lướt ở tick bắt đầu là 1.5 chứ không phải 89/60; pulse lại phải trúng S1 hai lần; sai số do làm tròn 3 chữ số), cộng 1 kịch bản test vô lý (Bóng Mực thứ hai đánh trúng làm hụt đom đóm). Phát hiện bằng cách đọc thông báo lỗi rồi đối chiếu ticket; sửa test, giữ nguyên luật. Đã thêm quy tắc vào CLAUDE.md. (2) Bot tự chơi thua hết ván lúc đầu: soi log sự kiện thì luật đúng, bot ngây thơ; sau khi cải tiến chỉ thắng được Đêm 1, ghi "chưa đạt" cho Đêm 2–3. (3) Mũi tên chỉ đèn không hiện (`display = ''` rơi về CSS `none`), phát hiện nhờ chụp màn hình bằng Chrome headless |

## Cách tiết kiệm token
- Đề bài lưu thành file trong repo, nên không phải dán lại vào chat ở các phase sau.
- Chỉ đọc tài liệu lab khi cần, theo hướng dẫn trong CLAUDE.md.
- Viết test theo contract trước rồi mới viết phần 3D. Cố tình làm hỏng code để kiểm tra test thay vì review dài.
- Bằng chứng headless do script tạo ra, không dùng ảnh.
