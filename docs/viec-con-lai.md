# Việc còn lại sau MVP

Các điểm nhỏ đã được review toàn nhánh xếp loại "làm sau" (không chặn chạy thật).

## Nên làm sớm
- SQL `create_order` / `replace_order_lines` tự tính tổng tiền từ `p_lines` thay vì tin số do server gửi (hiện mọi đường gọi đều đúng).
- Tính tiền bằng số nguyên (basis points) để tránh lệch 1đ ở mốc làm tròn .5 với tỷ lệ lẻ (vd 1,15%).
- `proxy.ts` chặn người chưa đăng nhập khỏi `/doi-tac`, `/admin` (phòng thủ thêm); bọc guard bằng React `cache()`.
- Bảng tỷ lệ (RateGrid) kiểm tra 0–100 phía client trước khi lưu từng bậc.
- Ghi log ai sửa dòng đơn (replace_order_lines).
- Cựu CTV đã chuyển sang bậc đại lý mà còn đơn cũ có nông dân: nhân viên chưa sửa được các đơn đó.

## Khi triển khai thật (smoke test)
- Upload ảnh lên Supabase Storage bucket `products` (chưa thử với Storage thật).
- Ảnh bảng giá `/bang-gia/anh` hiển thị đúng font tiếng Việt trên môi trường deploy.
- Email nội bộ `@partner.local` được Supabase Auth bản hosted chấp nhận.
- Nền tảng phải tự đặt header `x-forwarded-for` (Vercel có) cho giới hạn đơn lẻ.

## Cải thiện trải nghiệm / hiệu năng (khi cần)
- Giỏ hàng và trang chi tiết đang tải cả catalog (ổn dưới ~200 sản phẩm).
- "Đặt lại" ghi đè đơn nháp đang soạn mà không hỏi; nháp không đồng bộ giữa nhiều tab.
- Thông báo "không sửa được" bị mất sau khi trang tự làm mới (chi tiết đơn của CTV).
- Trang nông dân của CTV tải mọi dòng đơn để tính thống kê.
- Ô số lượng chưa chặn trên 9999 (server vẫn chặn).
- Icon PWA dạng maskable; chưa có service worker (chưa dùng offline hoàn toàn).
- Chạy `test:int` / `test:e2e` sẽ xóa dữ liệu local (db:reset).
