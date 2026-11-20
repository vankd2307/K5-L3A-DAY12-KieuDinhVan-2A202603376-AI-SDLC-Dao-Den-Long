# ADR 0002: Đo hiệu năng, soak test và bảng xếp hạng cho bản web

- Trạng thái: Chấp nhận (Phase 4, Contract v1.3, release v1.0.0)
- Không thay luật chơi nào. Đầu ra headless giữ nguyên từng byte (test `P4-HEADLESS`).

## Bối cảnh
Game là bản web (Three.js trong trình duyệt). Phase 4 yêu cầu những thứ bản web không tự có: một lệnh mở **cửa sổ 1280×720 không vsync** rồi tự thoát với mã 0, đo **RSS của tiến trình**, và lưu bảng xếp hạng **trên đĩa** để xuất bằng `<run_cmd> --export-leaderboard`. Không được cài thêm package (yêu cầu môi trường làm lab).

## Quyết định

### 1. Benchmark = Node điều khiển Chrome thật qua DevTools Protocol
- `npm run bench` build `dist/`, phục vụ bằng `vite preview`, rồi mở Chrome/Edge đã cài trên máy với `--disable-gpu-vsync --disable-frame-rate-limit`. Cửa sổ được nới ra sao cho vùng vẽ đúng 1280×720, tỉ lệ điểm ảnh 1.
- Script nói chuyện với Chrome bằng `WebSocket` có sẵn trong Node 22, không cần Puppeteer.
- Trang `?bench` tự chạy cảnh chuẩn (`createBenchGame` trong core) và ghi thời gian từng khung vào `window.__bench`. Node tính các chỉ số bằng `benchStats()`, một hàm thuần có unit test.
- `load_ms`: từ `performance.timeOrigin` của tiến trình Node tới khung hình đầu tiên của cảnh bench (đồng hồ epoch chung của máy).
- `peak_mem_mb`: tổng RSS (Working Set trên Windows) của **toàn bộ cây tiến trình Chrome** (browser, GPU, renderer...), đọc từ bảng tiến trình của hệ điều hành khoảng mỗi giây. Lúc đầu dùng `SystemInfo.getProcessInfo` của CDP, nhưng lệnh này không trả lời khi có cửa sổ thật đang chạy nặng.

### 2. Cảnh bench nằm trong core, bật bằng cờ
`Game.bench = true` tắt đúng các thứ §1.4 liệt kê (sinh thêm, sát thương, nhặt, hao dầu, kết thúc) và bỏ qua Mây khi Bóng Mực chọn trạng thái, nên cả 200 con luôn `wander`. Mặc định là `false`: mọi đường chạy khác giữ nguyên.

### 3. Soak test chạy thẳng `Game` trong một tiến trình
Input ngẫu nhiên đến từ một luồng RNG riêng (seed của Đêm `xor` hằng số), nên không đụng tới RNG của `Game`. Đo RSS bằng `process.memoryUsage().rss`, gọi `gc()` trước mỗi lần đo (`--expose-gc` có sẵn trong `soak_cmd`).

### 4. Bảng xếp hạng: file trên đĩa qua middleware của Vite, dự phòng localStorage
- `run_cmd` đổi thành `npm start` ([scripts/play.ts](../../scripts/play.ts)): mở Vite dev server, hoặc chạy `--export-leaderboard out.json` rồi thoát.
- Dev server và preview server có `/api/leaderboard` (GET/POST), đọc ghi `~/.dao-den-long/leaderboard.json`, hoặc `$DDL_DATA_DIR` nếu có. Ghi bằng file tạm rồi đổi tên, nên không bao giờ để lại file ghi dở.
- Logic xếp hạng ([src/leaderboard.ts](../../src/leaderboard.ts)) thuần, dùng chung cho trình duyệt và Node.
- Bản tĩnh trong Release không có API, nên lưu vào `localStorage` (trình duyệt cũng giữ trên đĩa). Lần sau mở bằng `npm start`, các điểm này được đẩy lên file.

## Hệ quả
- Bench cần Chrome, Chromium hoặc Edge đã cài. Nếu ở chỗ lạ thì dùng `--chrome <path>` hoặc `CHROME_PATH`.
- `peak_mem_mb` của bản web gồm cả tiến trình GPU và browser, nên lớn hơn một game native tương đương. Đó là cái giá thật của việc chạy trong Chrome.
- `--export-leaderboard` chỉ thấy điểm đã lưu khi chơi qua `npm start` / `npm run dev`. Điểm lưu ở bản tĩnh nằm trong trình duyệt cho tới khi được đồng bộ.
