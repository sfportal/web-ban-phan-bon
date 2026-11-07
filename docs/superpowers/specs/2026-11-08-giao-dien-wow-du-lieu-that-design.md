# Làm lại giao diện ("wow") + dữ liệu sản phẩm thật — Thiết kế

- Ngày: 2026-11-08 · Trạng thái: đã duyệt trong chat
- Phạm vi: cả 4 khu (cửa hàng, đăng ký/đăng nhập, khu đối tác, quản trị) + dữ liệu sản phẩm.
- Không đổi logic tiền, đơn hàng, phân quyền, RLS.

## 1. Mục tiêu & tiêu chí
Khách/CTV mở web thấy cửa hàng vật tư nông nghiệp chuyên nghiệp, đáng tin, đẹp trên điện thoại (390px) và máy tính.
- Trang chủ có banner ảnh thật, ô nhóm có ảnh, sản phẩm nổi bật, dải cam kết, footer.
- Mỗi sản phẩm có ảnh (thật nếu đã tải lên, nếu không thì ảnh minh họa bao bì tự vẽ), mô tả ngắn, thương hiệu, thành phần, công dụng, cách dùng, cây trồng phù hợp.
- Toàn bộ test cũ vẫn đạt; Lighthouse không bắt buộc.

## 2. Hình ảnh
- Ảnh không gian (hero, nhóm, auth, khu đối tác): ảnh Unsplash/Pexels (giấy phép cho phép dùng thương mại, miễn phí), nhúng bằng URL CDN (`images.unsplash.com`, `images.pexels.com`). Danh sách + tác giả + link gốc trong `docs/nguon-anh.md` và `lib/media/images.ts`.
- Không dùng ảnh bao bì của hãng. Ảnh sản phẩm khi `image_url` rỗng = SVG minh họa sinh bằng code (`components/PackageArt.tsx`): hình bao (bao 50kg/25kg/10kg/5kg/1kg), chai (chai/lọ ml/L), gói (g), cuộn/vật tư (cuộn, cái, bộ) theo `unit`; màu theo nhóm; in tên rút gọn, thương hiệu, tỷ lệ N-P-K (nếu tên chứa dạng `a-b-c`) và quy cách. Không dùng logo/nhãn hiệu thật, chỉ chữ thường.
- Nếu ảnh CDN lỗi, fallback về gradient màu nhóm (không vỡ layout).

## 3. Dữ liệu
- Bảng `products` thêm cột (migration `0005_product_details.sql`): `brand text`, `short_desc text`, `composition text`, `benefits text`, `usage text`, `crops text[] not null default '{}'`, `is_featured boolean not null default false`. Cột cũ `description` giữ nguyên (mô tả dài, tùy chọn).
- `categories` thêm `image_url text`, `slug text unique` (slug cho URL lọc nhóm).
- Bộ dữ liệu ~30 sản phẩm thật phổ biến ở VN trong `data/products.json` (nguồn tra cứu ghi trong `data/sources.md`): NPK các hãng, urê, DAP, kali, lân, hữu cơ vi sinh, phân bón lá/vi lượng, thuốc BVTV thông dụng (đã đăng ký lưu hành), vật tư. Giá = giá tham khảo thị trường tại thời điểm tra cứu (ghi chú trong UI admin và docs).
- `scripts/gen-seed.ts` sinh `supabase/seed.sql` (local/test) và `supabase/data-update-production.sql` (production: ẩn sản phẩm mẫu cũ chưa có đơn, xóa sản phẩm mẫu chưa có đơn, upsert theo SKU, cập nhật ảnh nhóm). Tỷ lệ bậc đối tác giữ nguyên theo nhóm.
- Excel sản phẩm thêm cột: `Thương hiệu | Mô tả ngắn | Thành phần | Công dụng | Cách dùng | Cây trồng (phân cách bằng dấu phẩy) | Nổi bật`. Nhập file mẫu cũ (8 cột) vẫn được (cột mới coi như trống).

## 4. Giao diện
- Bộ nhận diện: xanh lá nông nghiệp (primary), vàng lúa (accent), nền kem nhạt, Be Vietnam Pro, bo góc 12–16px, bóng nhẹ, icon `lucide-react`. Token màu trong `app/globals.css` (Tailwind 4 `@theme`).
- Thành phần dùng chung `components/ui/`: Button (primary/secondary/ghost, size md/lg ≥44px), Card, Badge, Input/Select/Textarea, SectionHeader, EmptyState, StatCard, PageShell.
- Cửa hàng: header dính (logo chữ + tìm kiếm + giỏ), hero ảnh lớn + CTA "Mua ngay"/"Trở thành CTV", lưới nhóm có ảnh, "Sản phẩm nổi bật", dải cam kết 3–4 ý, lưới sản phẩm có lọc, thẻ sản phẩm (ảnh, thương hiệu, tên, quy cách, giá, nhãn KM), trang chi tiết (ảnh lớn, giá, tab Công dụng/Thành phần/Cách dùng/Cây phù hợp, sản phẩm cùng nhóm), giỏ hàng với thanh tổng cố định đáy, footer (liên hệ, Zalo, link CTV).
- Đăng ký/đăng nhập/chờ duyệt: chia đôi (ảnh + lợi ích CTV | form); mobile ảnh dải trên.
- Khu đối tác: header chào + StatCard (hoa hồng/tiết kiệm tháng này, đơn đang xử lý, số nông dân), nút lớn "Lên đơn mới", KM dạng thẻ cuộn ngang; luồng lên đơn: thanh 3 bước, thẻ sản phẩm có ảnh; danh sách đơn/nông dân/hoa hồng dạng thẻ.
- Quản trị: sidebar có icon (thu gọn trên mobile), StatCard tổng quan, bảng zebra, form sản phẩm có các trường mới + xem trước ảnh minh họa.

## 5. Kiểm thử & triển khai
- Unit: PackageArt (chọn hình theo unit, trích N-P-K, màu nhóm), parse Excel cột mới + tương thích mẫu cũ, gen-seed (đủ trường, SKU duy nhất, giá nguyên dương).
- Integration: migration + catalog trả trường mới; admin lưu trường mới.
- E2E hiện có cập nhật selector nếu đổi; thêm kiểm tra trang chi tiết có tab.
- Deploy: push GitHub → Vercel tự build; chạy `0005` + `data-update-production.sql` trên Supabase production qua SQL Editor; chụp màn hình kiểm tra.
