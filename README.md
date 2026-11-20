# Đảo Đèn Lồng

Game 3D góc nhìn thứ ba (TypeScript + Three.js + Vite). Bạn vào vai Mây, gom đom đóm để thắp lại 5 Đèn Lồng Lớn trên Đảo Bến, đồng thời né Bóng Mực trong sương đen.

> Video demo: _(thêm ở Phase 4)_

## Cài đặt và chạy

Cần Node.js 20 trở lên. Chạy được trên macOS, Linux và Windows.

```bash
npm ci          # cài đặt
npm run dev     # mở game: http://localhost:5173
```

Các lệnh khác:

| Lệnh | Việc |
|---|---|
| `npm test` | Chạy toàn bộ test: luật game, Test Contract, CLI |
| `npm run typecheck` | Typecheck, kèm kiểm tra riêng rằng `src/core` không dùng DOM/three/Node |
| `npm run build` | Build bản web tĩnh vào `dist/` |
| `npm run autoplay -- <seed> <out.json>` | Bot tự chơi một ván và ghi ra file inputs |

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D | Đi lại (theo hướng camera) |
| Space | Nhảy |
| E | Nạp đom đóm vào đèn ở gần |
| F hoặc Shift | Tỏa sáng: tốn 2 đom đóm, làm choáng và đẩy lùi Bóng Mực ở gần |
| ← → hoặc kéo chuột | Xoay camera |
| R | Chơi lại |

## Luật chơi

- Đi gần đom đóm là tự nhặt, mang tối đa 10 con.
- Đứng gần một đèn chưa thắp rồi bấm **E** để nạp. Mỗi đèn cần **5** đom đóm.
- Bóng Mực đuổi theo Mây. Bị chạm thì mất 1 ngọn lửa (có 3 ngọn), rơi một nửa số đom đóm đang mang, và được bất tử 2 giây.
- Bóng Mực sợ đèn: chúng không vào được vùng bán kính 5 m quanh **mọi** đèn.
- Thắp đủ 5 đèn là **thắng**. Mất hết lửa, hoặc trời sáng (hết 300 giây) mà chưa thắp xong thì **thua**.

### Cách tính điểm

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị làm choáng | +25 |
| Khi **thắng**: mỗi giây còn lại (làm tròn xuống) | +1 |
| Khi **thắng**: mỗi ngọn lửa còn lại | +50 |

Khi thua thì giữ số điểm đã có, không cộng thưởng cuối màn.

## Chế độ headless (Test Contract v1.0)

Khai báo trong [game.contract.json](game.contract.json):

```bash
npm ci
node --import tsx src/headless/cli.ts --seed 1 --night 1 --ticks 3600 --out out.jsonl \
     [--scenario s.json] [--inputs i.json|i.jsonl] [--snapshot-every 60]
```

- Mặc định `--snapshot-every` là **60**. Ngoài các snapshot định kỳ, lúc kết thúc luôn có thêm một snapshot cuối, rồi tới dòng `end`.
- File `--inputs` nhận được cả `{ "frames": [...] }` lẫn JSONL (mỗi dòng một frame).
- Mã thoát: `0` là thành công; `2` là sai tham số hoặc file inputs/scenario sai định dạng; `1` là lỗi khác (ví dụ không tìm thấy file).
- Snapshot có thêm trường `score`, ngoài các trường contract yêu cầu.
- Trong `tuning`, `fall_enabled` là `false` vì mép đảo là tường mềm, Mây không rơi được. Vì vậy sự kiện `player_hit` với `by: "fall"` không bao giờ xảy ra.

Kiến trúc: toàn bộ luật game nằm trong [src/core/](src/core/), viết bằng TypeScript thuần, bước thời gian cố định 60 tick/giây, số ngẫu nhiên lấy từ bộ sinh có seed. Bản web ([src/render/](src/render/)) và CLI headless ([src/headless/cli.ts](src/headless/cli.ts)) cùng điều khiển một class `Game`, nên luật chơi ở hai bên giống hệt nhau.

## Bằng chứng và ghi chép

- Bằng chứng Phase 1: [docs/proof/phase-1/README.md](docs/proof/phase-1/README.md)
- Giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md)
- Nhật ký dùng AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Harness AI: [CLAUDE.md](CLAUDE.md)

## Sáng tạo của tôi

- Đèn lồng nhỏ treo trên nón lá của Mây sáng mạnh hơn khi mang nhiều đom đóm.
- Bầu trời và sương ngả từ tím đen sang ấm dần theo số đèn đã thắp.
- Biển mây, cây và sao chỉ để trang trí, nằm hoàn toàn ở phần hiển thị nên không ảnh hưởng đầu ra headless.
- Có bot tự chơi (`npm run autoplay`) để chứng minh màn chơi thắng được.
