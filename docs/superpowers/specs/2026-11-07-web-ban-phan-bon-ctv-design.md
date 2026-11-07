# Website bán phân bón & vật tư nông nghiệp cho CTV/đối tác — Thiết kế

- Ngày: 2026-11-07
- Trạng thái: chờ duyệt
- Tên thương hiệu: chưa có (dùng tên tạm trong code qua biến cấu hình `NEXT_PUBLIC_SITE_NAME`)

## 1. Mục tiêu & bối cảnh

Doanh nghiệp bán phân bón, thuốc BVTV, vật tư nông nghiệp. Phần lớn đơn hàng đến từ **cộng tác viên (CTV) và đại lý** gom đơn, đặt giùm nông dân; nông dân tự đặt lẻ chiếm tỷ lệ nhỏ. Hiện quản lý bằng Excel/sổ sách, CTV nhắn đơn qua Zalo/điện thoại.

Ưu tiên của bản đầu (MVP), theo thứ tự:

1. **(A)** CTV tự lên đơn nhanh trên điện thoại, thay cho nhắn Zalo và nhập tay.
2. **(B)** Hoa hồng/chiết khấu tính tự động, minh bạch, đối soát được.
3. **(C)** Bảng giá, catalog, khuyến mãi luôn cập nhật cho CTV.

**Tiêu chí thành công:**
- CTV lên xong đơn cho một nông dân trong khoảng 1 phút trên điện thoại.
- Admin không phải tính hoa hồng bằng tay; bảng hoa hồng tháng xuất Excel khớp với đơn đã thu tiền.
- Không còn trường hợp CTV báo giá cũ hoặc giá sai do không biết khuyến mãi/đổi giá.

**Ràng buộc:** quy mô năm đầu nhỏ (< 50 CTV, < 200 sản phẩm, vài chục đơn/ngày); không có lập trình viên nội bộ nên phải dễ vận hành, không tự quản server; giao diện tiếng Việt, VNĐ, múi giờ Asia/Ho_Chi_Minh.

## 2. Kiến trúc

- **Next.js** (App Router, TypeScript) — một ứng dụng duy nhất, chạy trên **Vercel**.
- **Supabase** — Postgres, Auth, Storage (ảnh sản phẩm), Row Level Security (RLS).
- Mọi phép tính giá, chiết khấu, hoa hồng chạy **phía server** (Server Actions / hàm Postgres). Dữ liệu tiền gửi từ trình duyệt không bao giờ được tin.
- Giao diện ưu tiên di động, cài được ra màn hình chính (PWA). Trang admin tối ưu máy tính.

### Ba khu

| Khu | Đường dẫn | Người dùng | Chức năng |
|---|---|---|---|
| Cửa hàng công khai | `/` | Nông dân, khách | Catalog, giá niêm yết, khuyến mãi, đặt đơn lẻ không cần tài khoản |
| Khu đối tác | `/doi-tac` | CTV hoa hồng, đại lý | Giá theo loại tài khoản, lên đơn nhanh, danh sách nông dân, hoa hồng |
| Quản trị | `/admin` | Admin, nhân viên | Duyệt đối tác, sản phẩm, giá, khuyến mãi, đơn, hoa hồng, xuất Excel |

### Vai trò

| Vai trò | Quyền |
|---|---|
| Khách | Xem catalog công khai, đặt đơn lẻ |
| CTV hoa hồng | Thấy giá niêm yết + % hoa hồng; đơn ghi theo từng nông dân; chỉ thấy đơn/nông dân của mình |
| Đại lý (mua sỉ) | Thấy giá sau chiết khấu của bậc mình; đơn gộp, giao một điểm |
| Nhân viên | Xử lý đơn (đổi trạng thái, in phiếu); không sửa giá, tỷ lệ, bậc đối tác |
| Admin | Toàn quyền |

### Đăng nhập & tài khoản

- Đối tác đăng nhập bằng **SĐT + mật khẩu** (Supabase Auth email/password; SĐT chuẩn hóa được ánh xạ sang email nội bộ dạng `<sdt>@partner.local`, người dùng không thấy email này). Không dùng OTP SMS ở MVP.
- Đối tác tự đăng ký (SĐT, tên, khu vực, địa chỉ nhận hàng) → trạng thái `pending` → admin duyệt, gán **bậc đối tác** → `active`. Admin có thể `locked`.
- Quên mật khẩu: admin đặt lại mật khẩu tạm từ trang admin (MVP).

## 3. Mô hình dữ liệu

Tiền lưu dạng số nguyên VNĐ (`bigint`). Tỷ lệ lưu dạng `numeric(5,2)` (đơn vị %).

| Bảng | Trường chính |
|---|---|
| `categories` | id, name, sort_order |
| `products` | id, sku, name, unit (vd "bao 50kg"), category_id, list_price, image_url, in_stock (bool), is_active, description, updated_price_at |
| `partner_tiers` | id, name (vd "CTV chuẩn", "Đại lý cấp 1"), kind (`commission` \| `wholesale`) |
| `tier_rates` | tier_id, category_id, rate_pct — mức theo nhóm |
| `tier_product_rates` | tier_id, product_id, rate_pct — mức riêng từng sản phẩm (ghi đè) |
| `partners` | id, user_id, phone (unique), name, region, delivery_address, tier_id, status (`pending`\|`active`\|`locked`) |
| `farmers` | id, phone (unique), name, address, owner_partner_id (nullable), created_at |
| `promotions` | id, name, scope (`product`\|`category`), target_id, type (`percent`\|`fixed_price`), value, starts_at, ends_at, is_active — `fixed_price` chỉ dùng với scope `product` |
| `orders` | id, code (vd DH2611-0001), source (`partner`\|`retail`), partner_id (nullable), status, delivery_address, payment_method (`cod`\|`transfer`), retail_name/phone/address (đơn lẻ), note, subtotal, partner_payable (đại lý), commission_expected, created_at |
| `order_lines` | id, order_id, farmer_id (nullable), product_id, qty, list_price_snap, sale_price_snap, promotion_id_snap, rate_pct_snap, line_total, line_commission, line_partner_price |
| `order_status_log` | order_id, from_status, to_status, changed_by, changed_at, note |
| `commission_entries` | id, partner_id, order_id, amount (có thể âm), period (YYYY-MM), status (`pending`\|`paid`), created_at, paid_at |
| `staff` | user_id, role (`admin`\|`staff`) |

## 4. Quy tắc tính giá & hoa hồng

1. **Giá bán thực tế** của sản phẩm tại thời điểm đặt = giá niêm yết, áp khuyến mãi đang hiệu lực nếu có. Nếu nhiều khuyến mãi cùng áp, lấy **giá thấp nhất**; khuyến mãi theo sản phẩm và theo nhóm được xét như nhau.
2. **Tra tỷ lệ** cho (bậc, sản phẩm): `tier_product_rates` → `tier_rates` theo nhóm → 0%.
3. **Đại lý (wholesale):** giá mua/đơn vị = làm tròn(giá bán thực tế × (1 − rate/100)) đến đồng. `partner_payable` = tổng giá mua.
4. **CTV (commission):** hoa hồng dòng = làm tròn(giá bán thực tế × qty × rate/100). Nông dân trả giá bán thực tế.
5. **Chụp giá (snapshot):** khi gửi đơn, server tính lại và lưu giá niêm yết, giá bán, khuyến mãi, tỷ lệ vào `order_lines`. Thay đổi giá/tỷ lệ về sau không ảnh hưởng đơn cũ.
6. **Đơn lẻ:** giá bán thực tế. Nếu SĐT người đặt trùng `farmers.phone` có `owner_partner_id`, đơn được gắn `partner_id` của CTV đó và tính hoa hồng theo bậc của CTV; nếu không, không có hoa hồng.

### Khóa khách theo CTV

- Khi CTV thêm nông dân mới bằng SĐT chưa tồn tại → tạo `farmers` với `owner_partner_id` = CTV đó.
- SĐT đã thuộc CTV khác → **chặn**, hiển thị "Khách này đã thuộc CTV khác, vui lòng liên hệ admin". Không lộ tên CTV kia.
- SĐT tồn tại nhưng chưa có chủ (từ đơn lẻ trước đó) → gán cho CTV đang nhập.
- Admin có thể chuyển `owner_partner_id`; thao tác được ghi log. Việc chuyển không ảnh hưởng hoa hồng của đơn đã có.
- SĐT được chuẩn hóa trước khi lưu/so khớp (bỏ khoảng trắng, đổi `+84` → `0`).

### Ghi nhận hoa hồng

- Khi đơn chuyển sang `paid` (đã giao + đã thu đủ tiền) → tạo `commission_entries` với amount = tổng `line_commission`, period = tháng hiện tại, status `pending`.
- Admin chốt kỳ theo tháng, đánh dấu `paid` (đã chi) từng dòng hoặc hàng loạt.
- Đơn `cancelled` trước khi `paid` → không có hoa hồng.
- Đơn `returned` sau khi đã có hoa hồng → tạo dòng **âm** tương ứng vào kỳ hiện tại. Không sửa/xóa dòng cũ. MVP chỉ hỗ trợ trả hàng toàn bộ đơn.

## 5. Luồng nghiệp vụ

### CTV lên đơn (di động)

1. "Đơn mới" → chọn nông dân: tìm theo SĐT/tên trong danh sách của mình, hoặc "Thêm nhanh" (tên + SĐT bắt buộc, địa chỉ không bắt buộc).
2. Chọn sản phẩm: tìm kiếm, lọc nhóm, mục "Hay đặt" (10 sản phẩm CTV đặt nhiều nhất); nút +/− số lượng. Hiển thị giá bán và hoa hồng/đơn vị.
3. "+ Nông dân khác" để thêm nông dân vào cùng đơn tổng.
4. Màn hình xác nhận: tổng theo từng nông dân, tổng đơn, hoa hồng dự kiến, điểm giao (mặc định địa chỉ CTV, sửa được), ghi chú → "Gửi đơn".
5. "Đặt lại" từ đơn cũ: sao chép dòng hàng sang đơn mới với giá hiện tại.

### Đại lý lên đơn

Cùng màn hình, bỏ bước chọn nông dân. Xác nhận hiển thị tổng theo giá niêm yết, giá mua sau chiết khấu, số tiền tiết kiệm.

### Đơn lẻ

Giỏ hàng trên cửa hàng công khai → form tên, SĐT, địa chỉ, COD/chuyển khoản → gửi. Trang cảm ơn hiển thị mã đơn và thông tin chuyển khoản (cấu hình trong admin). Admin gọi xác nhận.

### Trạng thái đơn

```
new → confirmed → shipping → delivered → paid
 │        │          │
 └────────┴──────────┴──→ cancelled
delivered/paid → returned
```

- CTV/đại lý sửa hoặc hủy đơn khi đơn còn `new`. Từ `confirmed` trở đi chỉ admin/nhân viên thao tác.
- Chuyển sang `paid` kích hoạt ghi nhận hoa hồng; `returned` sau `paid` kích hoạt dòng âm.
- Mọi thay đổi trạng thái ghi vào `order_status_log`.
- Chuyển trạng thái được kiểm tra hợp lệ ở server theo sơ đồ trên.

### Thông báo

- Đơn mới → email cho admin, và tin nhắn vào nhóm Telegram nếu đã cấu hình bot token/chat id.
- CTV xem trạng thái đơn trong app (không push/Zalo ở MVP).

### Bảng giá & khuyến mãi cho CTV

- Trang chủ khu đối tác: khuyến mãi đang chạy, sản phẩm đổi giá trong 14 ngày gần nhất.
- "Chia sẻ bảng giá": link công khai đến trang bảng giá lẻ (có thể lọc theo nhóm) và nút tải ảnh để gửi Zalo. Không hiển thị hoa hồng/chiết khấu.

## 6. Trang quản trị

- **Tổng quan:** đơn mới hôm nay, đơn chờ thu tiền, doanh số tháng, hoa hồng chờ chi.
- **Sản phẩm:** CRUD, ẩn/hiện, bật/tắt còn hàng, tải ảnh, **nhập/xuất Excel** (theo SKU: tạo mới hoặc cập nhật).
- **Nhóm sản phẩm.**
- **Bậc đối tác & tỷ lệ:** bảng lưới bậc × nhóm để sửa % trực tiếp; danh sách ghi đè theo sản phẩm.
- **Khuyến mãi:** CRUD, thời gian hiệu lực.
- **Đối tác:** duyệt, đổi bậc, khóa, đặt lại mật khẩu.
- **Nông dân:** tìm kiếm, xem lịch sử mua, chuyển CTV sở hữu.
- **Đơn hàng:** lọc theo trạng thái/CTV/ngày/nguồn, đổi trạng thái (từng đơn và hàng loạt), sửa đơn, in phiếu giao hàng (trang in A5).
- **Hoa hồng:** theo tháng và theo CTV, đánh dấu đã chi, xuất Excel.
- **Cài đặt:** tên cửa hàng, thông tin chuyển khoản, email nhận thông báo, Telegram.
- **Xuất dữ liệu:** xuất đơn hàng theo khoảng ngày ra Excel cho kế toán.

## 7. Xử lý lỗi & an toàn

- Server tính lại toàn bộ giá/tỷ lệ/tổng khi gửi đơn. Nếu giá hoặc tình trạng còn hàng khác so với lúc CTV xem, trả về danh sách dòng thay đổi; màn hình xác nhận đánh dấu các dòng đó và yêu cầu CTV xác nhận lại.
- Sản phẩm hết hàng hoặc bị ẩn → không cho gửi dòng đó.
- RLS: CTV/đại lý chỉ đọc/ghi `orders`, `order_lines`, `farmers`, `commission_entries` của chính mình; chỉ đọc tỷ lệ của bậc mình. Khách chỉ đọc sản phẩm đang bán và khuyến mãi đang chạy. Bảng nội bộ chỉ admin/nhân viên.
- Đối tác `pending`/`locked` không vào được khu đối tác.
- Giỏ đơn đang soạn lưu ở `localStorage` (bọc try/catch); mất mạng không mất đơn. Nút gửi chống bấm đúp; server dùng khóa idempotency theo phiên soạn đơn để không tạo đơn trùng.
- Form đơn lẻ có giới hạn tần suất theo IP/SĐT và trường honeypot chống spam.
- Sao lưu: dựa vào backup hằng ngày của Supabase; admin có nút xuất toàn bộ dữ liệu chính ra Excel.

## 8. Kiểm thử

- **Unit test (Vitest)** cho module tính tiền thuần (`lib/pricing`): giá bán khi có/không khuyến mãi, chọn khuyến mãi tốt nhất, tra tỷ lệ theo thứ tự ưu tiên, chiết khấu đại lý, hoa hồng CTV, làm tròn, đơn lẻ gắn CTV chủ.
- **Test logic trạng thái & hoa hồng:** chuyển trạng thái hợp lệ/không hợp lệ, tạo hoa hồng khi `paid`, dòng âm khi `returned`, không hoa hồng khi `cancelled`.
- **Test khóa khách:** chuẩn hóa SĐT, chặn trùng, gán khách chưa có chủ, chuyển chủ.
- **Test RLS** trên Supabase local: CTV A không đọc được dữ liệu CTV B; đại lý không đọc tỷ lệ bậc khác.
- **E2E (Playwright, viewport di động):** đăng ký → admin duyệt → CTV lên đơn 2 nông dân → admin chuyển tới `paid` → hoa hồng xuất hiện; đại lý lên đơn; khách đặt đơn lẻ.

## 9. Phạm vi

**Trong MVP:** toàn bộ mục 2–8.

**Ngoài MVP (để sau):** công nợ trả chậm theo mùa vụ; thưởng bậc doanh số; hoa hồng nhiều cấp; thanh toán online tự động; kết nối đơn vị vận chuyển; nhiều kho/tồn kho số lượng; Zalo OA / Zalo Mini App; đăng nhập OTP; trả hàng một phần; đồng bộ phần mềm kế toán.

## 10. Vận hành & chi phí

- Supabase gói Free và Vercel gói Hobby đủ cho quy mô hiện tại; tên miền khoảng vài trăm nghìn đồng/năm. Lưu ý: dự án Supabase Free bị tạm dừng nếu không hoạt động 7 ngày; khi chạy thật nên nâng Supabase Pro (~25 USD/tháng) để có backup và không bị tạm dừng.
- Lưu ý: gói Vercel Hobby dành cho mục đích phi thương mại; khi chạy kinh doanh thật cần cân nhắc Vercel Pro (~20 USD/tháng) hoặc chuyển sang Cloudflare.
- Tài liệu hướng dẫn vận hành ngắn cho admin (duyệt CTV, nhập sản phẩm từ Excel, chốt hoa hồng tháng) là một phần của bàn giao.
