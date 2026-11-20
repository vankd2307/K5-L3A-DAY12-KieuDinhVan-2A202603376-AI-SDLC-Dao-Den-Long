# Nhật ký dùng AI

Công cụ: Claude Code (model Opus) trong VS Code.

| Phase | Việc | Token/chi phí ước tính | AI sai ở đâu / cách phát hiện |
|---|---|---|---|
| 0 | Dựng khung TS + Three.js + Vite, tách core headless | _(điền theo /usage)_ | Heredoc bash lỗi parse trên Windows → chuyển sang dùng tool Write. `.gitignore` có BOM và đang bỏ qua `CLAUDE.md` (trái RULES §7) → AI phát hiện khi review và đã sửa |
| 1 | Đọc PRD-0; viết core theo Contract v1.0, CLI, 37 test, bot tự chơi, bản 3D | _(điền theo /usage)_ | Không đọc được lab board trực tiếp (artifact ngoài tài khoản); PDF in ra bị trắng → người dùng copy chữ vào `docs/requirements/phase-1.md`. Một lỗi typecheck (`noUncheckedIndexedAccess` trong scenario.ts), bắt được bằng `npm run typecheck` |

## Cách tiết kiệm token
- Đề bài lưu thành file trong repo, nên không phải dán lại vào chat ở các phase sau.
- Chỉ đọc tài liệu lab khi cần, theo hướng dẫn trong CLAUDE.md.
- Viết test theo contract trước rồi mới viết phần 3D. Cố tình làm hỏng code để kiểm tra test thay vì review dài.
- Bằng chứng headless do script tạo ra, không dùng ảnh.
