-- Mô tả chi tiết sản phẩm và ảnh/slug nhóm (giao diện mới). Cột cũ `description` giữ nguyên.
-- RLS/quyền không đổi: SELECT cấp theo bảng ở 0002 đã phủ cột mới; ghi vẫn chỉ qua service_role.
-- `if not exists` để chạy lại trên Supabase bản thật không lỗi.

alter table public.products
  add column if not exists brand text,
  add column if not exists short_desc text,
  add column if not exists composition text,
  add column if not exists benefits text,
  add column if not exists usage text,
  add column if not exists crops text[] not null default '{}',
  add column if not exists is_featured boolean not null default false;

-- slug dùng cho URL lọc nhóm; null với nhóm tạo tay chưa đặt slug (unique cho phép nhiều null).
alter table public.categories
  add column if not exists slug text unique,
  add column if not exists image_url text;
