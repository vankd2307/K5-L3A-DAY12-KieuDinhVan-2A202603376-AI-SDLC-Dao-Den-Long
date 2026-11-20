# Đảo Đèn Lồng

Game 3D góc nhìn thứ ba (TypeScript + Three.js + Vite). Mây, người giữ đèn nhỏ tuổi, đi qua 3 đêm trên 3 hòn đảo, gom đom đóm để thắp và giữ các Đèn Lồng Lớn cháy tới bình minh, né Bóng Mực trong sương đen.

> Video demo: _(thêm ở Phase 4)_

## Cài đặt và chạy

Cần Node.js 20 trở lên. Chạy được trên macOS, Linux và Windows.

```bash
npm ci          # cài đặt
npm run dev     # mở game: http://localhost:5173
```

Mở `http://localhost:5173/?night=2` để vào thẳng một đêm. Thêm `&scenario=<JSON theo contract>` để dựng sẵn tình huống, `&instant` để hiện màn kết quả ngay (dùng khi thử nghiệm hoặc quay demo).

| Lệnh | Việc |
|---|---|
| `npm test` | 84 test: luật game, dầu đèn, Test Contract, CLI, hiệu năng, lưu cài đặt |
| `npm run typecheck` | Typecheck, kèm kiểm tra riêng rằng `src/core` không dùng DOM/three/Node |
| `npm run build` | Build bản web tĩnh vào `dist/` |
| `npm run autoplay -- <seed> <out.json> [night]` | Bot tự chơi một đêm và ghi ra file inputs |

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D | Đi lại (theo hướng camera) |
| Space | Nhảy |
| Shift hoặc Q | Lướt (14 m/s trong 0.2 s, hồi chiêu 1.5 s) |
| E | Nạp đom đóm vào đèn ở gần |
| F | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong bán kính 5 m |
| ← → hoặc kéo chuột | Xoay camera (chỉnh độ nhạy trong Cài đặt) |
| Cài đặt | Âm lượng, độ nhạy chuột, **Bảng màu dễ phân biệt** (viền Bóng Mực xanh lam, cảnh báo trắng kèm ⚠). Được lưu lại |
| Esc hoặc P | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |

## Ba đêm

| Đêm | Đảo | Đèn (cần sáng lúc bình minh) | Thời gian | Điểm mới |
|---|---|---|---|---|
| 1 | Đảo Bến | 5 (3) | 4:00 | Đảo tròn |
| 2 | Đảo Cau | 6 (4) | 4:30 | Hai đảo nối bằng cầu tre, bục nhảy, Gió Lạc, Bùa Gió |
| 3 | Đảo Chuông | 7 (5) | 5:00 | 3 tầng, dốc, bục nhảy lên đỉnh, tháp chuông, gió mạnh |

**Mục tiêu (Ticket-03): giữ đảo sáng tới bình minh.** Thắp hết đèn không kết thúc đêm. Thắng khi còn Ngọn Lửa lúc hết giờ và số đèn đang sáng ≥ 60% (3/5, 4/6, 5/7).
- Mang tối đa 10 đom đóm, +2 sau mỗi lần thắp thành công (tối đa 20). Đèn cần 10 đom đóm để thắp lần đầu, 5 để thắp lại.
- Đèn sáng hao 1 dầu/giây (tối đa 100) và tắt khi cạn. Bấm E ở đèn đang sáng để châm dầu: mỗi đom đóm +10 dầu.
- Bị Bóng Mực chạm: mất 1 Ngọn Lửa (có 3), rơi một nửa số đom đóm đang mang ra đất (nhặt lại được trong 8 s), rồi được bất tử 1.5 s.
- Rơi khỏi đảo: mất 1 Ngọn Lửa và toàn bộ đom đóm, hồi sinh ở điểm xuất phát.
- Đèn đang sáng với dầu ≥ 30 tạo vùng an toàn bán kính 6 m mà Bóng Mực không vào được. Dầu < 30 thì đèn nhấp nháy, mất vùng an toàn, và Bóng Mực kéo tới hút 5 dầu/giây.
- Gió Lạc chỉ để ý khi Mây mang từ 5 đom đóm trở lên, và cướp tối đa 3 con. Tỏa Sáng làm chúng bỏ chạy hoặc thả lại đồ đã cướp.
- Bùa Gió: trong 10 s chạy 7.2 m/s và lướt không cần hồi chiêu.

### Cách tính điểm

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Mỗi Bóng Mực trúng Tỏa Sáng | +5 (+15 nếu nó đang hút dầu) |
| Khi thắng đêm: mỗi đèn đang sáng | +50 + số dầu còn lại |
| Khi thắng đêm: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game là tổng điểm các đêm đã thắng. Thua thì chơi lại đêm đó.

## Chế độ headless (Test Contract v1.2)

Khai báo trong [game.contract.json](game.contract.json):

```bash
npm ci
node --import tsx src/headless/cli.ts --seed 1 --night 1 --ticks 3600 --out out.jsonl \
     [--scenario s.json] [--inputs i.json|i.jsonl] [--snapshot-every 60]
```

- `--night` nhận 1, 2, 3. Mặc định `--snapshot-every` là 60. Lúc kết thúc luôn có một snapshot cuối, rồi tới dòng `end`. Sự kiện `night_start` ghi ở tick 0.
- File `--inputs` nhận cả `{ "frames": [...] }` lẫn JSONL.
- Mã thoát: `0` là thành công; `2` là sai tham số hoặc file sai định dạng; `1` là lỗi khác.
- Snapshot có thêm trường `score`, ngoài các trường contract yêu cầu.

Kiến trúc: toàn bộ luật nằm trong [src/core/](src/core/), viết bằng TypeScript thuần, bước thời gian cố định 60 tick/giây, RNG có seed. Số chuẩn ở [tuning.ts](src/core/tuning.ts), bản đồ chuẩn ở [maps.ts](src/core/maps.ts). Bản web ([src/render/](src/render/)) và CLI cùng chạy một class `Game`. Thứ tự 12 bước của một tick nằm trong `Game.step()`.

## Bằng chứng và ghi chép

- Bằng chứng: [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md) · [Phase 3](docs/proof/phase-3/README.md)
- Spec Phase 2: [docs/notes/spec-phase-2.md](docs/notes/spec-phase-2.md) · Quyết định thiết kế Phase 3: [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-win.md) · [CHANGELOG](docs/CHANGELOG.md) (breaking changes)
- Giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md)
- Nhật ký dùng AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Harness AI: [CLAUDE.md](CLAUDE.md), skill [.claude/skills/verify-phase/](.claude/skills/verify-phase/SKILL.md)

## Sáng tạo của tôi

- Lời dẫn của Ông Đăng mở đầu mỗi đêm. Màn Bình Minh có lời cảm ơn.
- Đèn lồng nhỏ treo trên nón lá của Mây sáng hơn khi mang nhiều đom đóm. Mây nhấp nháy trong lúc bất tử.
- Toàn bộ âm thanh tổng hợp bằng WebAudio (nhạc ngũ cung, tiếng gió, tiếng chuông đếm ngược), không dùng file ngoài.
- Lá bay báo trước cơn gió ở Đêm 3. Đom đóm rơi nhấp nháy trước khi tan.
- Biển mây, cây, sao chỉ để trang trí, nằm ở phần hiển thị nên không ảnh hưởng đầu ra headless.
- Có bot tự chơi (`npm run autoplay`) để kiểm chứng.
