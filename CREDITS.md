# Credits

## Asset, hình ảnh, âm thanh
- **Không dùng file asset ngoài.** Mọi mô hình 3D (đảo, cây, đèn, Mây, Bóng Mực, Gió Lạc, Bùa Gió, tháp chuông) đều dựng bằng hình khối có sẵn của Three.js trong [src/render/scene.ts](src/render/scene.ts).
- **Âm thanh và nhạc** tổng hợp lúc chạy bằng Web Audio API ([src/render/audio.ts](src/render/audio.ts)): thang ngũ cung, tiếng gió, tiếng chuông đếm ngược. Không có file âm thanh.
- Phông chữ: phông hệ thống (`system-ui`). Biểu tượng 🔥 🍃 ⏳ ⚠ 👁 là emoji của hệ điều hành.

## Thư viện
| Thư viện | Dùng cho | Giấy phép |
|---|---|---|
| [three.js](https://threejs.org) r187 | Vẽ 3D (cả `BufferGeometryUtils` để gộp mesh) | MIT |
| [Vite](https://vite.dev) | Dev server, build | MIT |
| [Vitest](https://vitest.dev) | Test | MIT |
| [TypeScript](https://www.typescriptlang.org) | Ngôn ngữ | Apache-2.0 |
| [tsx](https://tsx.is) | Chạy TypeScript bằng Node (CLI headless, bench, soak) | MIT |

Benchmark dùng Chrome, Chromium hoặc Edge đã cài sẵn trên máy, điều khiển qua Chrome DevTools Protocol. Chrome không được đóng gói kèm theo.

## Công cụ AI tạo nội dung
- **Claude Code (Anthropic, model Claude Opus)** trong VS Code đã viết phần lớn mã nguồn, test, script bench/soak, tài liệu và lời thoại của Ông Đăng, dưới sự chỉ đạo, kiểm tra và quyết định của tác giả. Chi tiết từng phase, các lần AI sai và cách phát hiện: [docs/notes/ai-log.md](docs/notes/ai-log.md).
- Không dùng AI tạo hình ảnh, âm thanh hay nhạc.

## Đề bài
Bối cảnh, nhân vật, số liệu và bản đồ chuẩn lấy từ đề bài lab Day 12 "Đảo Đèn Lồng" (PRD-0, Ticket-02, Ticket-03, Phase 4).
