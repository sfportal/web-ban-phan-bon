# Ví hoa hồng, chi trả có chứng từ, rút tiền + dữ liệu đặt thử — Thiết kế

- Ngày: 2026-11-08 · Trạng thái: đã duyệt trong chat
- Không đổi: logic tạo đơn, giá, trạng thái đơn, ghi nhận hoa hồng (`commission_entries` earn/reversal).

## 1. Ví hoa hồng (CTV kind = commission)
- `earned` = Σ `commission_entries.amount` của đối tác (earn dương, reversal âm).
- `pending_out` = Σ `payouts.amount` trạng thái `requested` | `approved`.
- `paid` = Σ `payouts.amount` trạng thái `paid`.
- `available` = earned − pending_out − paid (có thể âm nếu trả hàng sau khi đã chi; khi âm không cho rút, hiển thị "Số dư âm do trả hàng sau khi đã chi").
- Đại lý (wholesale) không có ví.
- Cột `commission_entries.status/paid_at` không còn dùng cho chi trả (giữ trong DB cho tương thích); bỏ nút "đánh dấu đã chi" cũ.

## 2. Chi trả
- **Yêu cầu rút (source `request`)**: đối tác nhập số tiền; điều kiện: đã khai ngân hàng (`bank_name`, `bank_account`, `bank_holder` khác rỗng), số tiền nguyên ≥ `min_payout` (setting, mặc định 100.000), ≤ available. Trạng thái `requested` → `approved` → `paid`; hoặc `requested|approved` → `rejected` (bắt buộc lý do) → tiền trở lại available. Gửi thông báo admin (Telegram/email như đơn mới).
- **Đợt chi (source `batch`)**: admin chọn `kind` ∈ weekly | monthly | custom, `cutoff_date` (ngày chốt, giờ VN, tính hoa hồng có `created_at` < 00:00 VN ngày sau cutoff). Với mỗi CTV `active` có ngân hàng: amount = earned_tới_cutoff − pending_out − paid; nếu amount ≥ min_payout → tạo payout `approved` thuộc đợt. CTV thiếu ngân hàng hoặc dưới mức tối thiểu bị bỏ qua (trả về số lượng bỏ qua + lý do để hiển thị).
- **Đã chuyển**: admin nhập mã giao dịch (bắt buộc), ngày chuyển (bắt buộc, ≤ hôm nay), chứng từ ảnh/PDF (jpg/png/webp/pdf, ≤ 5MB, tùy chọn khi đánh dấu hàng loạt). Lưu snapshot ngân hàng lúc tạo payout.
- Mọi thay đổi tiền chạy trong hàm Postgres có `select … for update` trên dòng partners (khóa ví) để chống bấm đúp và rút vượt số dư.

## 3. Chứng từ
- Storage bucket riêng tư `payout-proofs`, đường dẫn `<partner_id>/<payout_id>.<ext>`. Đối tác xem qua signed URL 300 giây do server tạo sau khi kiểm tra quyền sở hữu; admin xem mọi chứng từ.

## 4. Màn hình
- Đối tác `/doi-tac/hoa-hong` → "Ví hoa hồng": 4 StatCard, nút "Rút tiền" (form số tiền, gợi ý "Rút hết"), thẻ ngân hàng (sửa được), lịch sử hoa hồng theo đơn, danh sách khoản chi (trạng thái, số tiền, mã GD, ngày, "Xem chứng từ").
- Admin `/admin/hoa-hong` → "Chi trả": tab Yêu cầu rút / Đợt chi / Số dư đối tác; dialog "Đánh dấu đã chuyển" có upload; tạo đợt chi; xuất Excel từng tab. Cài đặt thêm "Mức rút tối thiểu". Tổng quan: thẻ "Hoa hồng chờ chi" = Σ available dương + pending_out.

## 5. Dữ liệu đặt thử
- Cột `is_demo boolean not null default false` trên partners, farmers, orders, payouts, payout_batches.
- Admin `/admin/du-lieu-thu`: "Tạo dữ liệu thử" (admin nhập mật khẩu chung ≥ 8 ký tự) tạo: 3 CTV active (SĐT 0900000101–0900000103, có ngân hàng), 1 đại lý active (0900000104), 1 CTV pending (0900000105), 8 nông dân, ~15 đơn đủ trạng thái (new, confirmed, shipping, delivered, paid, cancelled, returned) qua đúng RPC hiện có, 3 đơn khách lẻ, 1 yêu cầu rút `requested`, 1 khoản chi `paid` (mã GD "DEMO-0001", không có file), 1 đợt chi. Từ chối nếu đã có dữ liệu thử hoặc trùng SĐT.
- "Xóa toàn bộ dữ liệu thử": xóa theo thứ tự FK mọi bản ghi `is_demo` + user auth của đối tác thử. Không đụng bản ghi thật.
- Trang admin hiện Badge "Thử" ở danh sách đơn, đối tác, nông dân, chi trả.

## 6. Kiểm thử
- Integration: tính ví; rút vượt số dư / dưới mức / thiếu ngân hàng bị chặn; hai yêu cầu song song không vượt số dư; từ chối hoàn tiền; đợt chi theo cutoff, bỏ qua đúng; mark paid idempotent; RLS: đối tác chỉ đọc payouts của mình, không đọc batches; signed URL chỉ cho chủ; tạo rồi xóa dữ liệu thử không đổi dữ liệu thật.
- E2E: CTV khai ngân hàng → rút → admin duyệt → đánh dấu đã chuyển → ví CTV cập nhật; admin tạo/xóa dữ liệu thử.

## 7. Triển khai
- Migration `0006_payouts.sql` (cột, bảng, RLS, hàm, settings `min_payout`) + tạo bucket `payout-proofs` (private) trên production qua SQL Editor; push main → Vercel.
