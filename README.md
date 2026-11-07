# Web bán phân bón cho CTV

Next.js (App Router) + Supabase. Cửa hàng công khai cho khách lẻ, khu đối tác `/doi-tac` cho
cộng tác viên (CTV, hưởng hoa hồng) và đại lý (mua giá chiết khấu), khu quản trị `/admin`.
Tài liệu thiết kế và kế hoạch nằm trong `docs/superpowers/`; hướng dẫn vận hành cho người
quản lý cửa hàng (không cần biết code) ở [`docs/huong-dan-van-hanh.md`](docs/huong-dan-van-hanh.md).

Yêu cầu: Node.js ≥ 20.12.

## Chạy local

Không cần Docker hay Supabase CLI: `scripts/stack/` dựng một stack Supabase tối giản
(Postgres từ `embedded-postgres`, Supabase Auth/GoTrue, PostgREST và một gateway
Node ở `http://127.0.0.1:54321` phục vụ `/auth/v1` và `/rest/v1`). Không có Storage
(tải ảnh sản phẩm chỉ chạy được trên Supabase thật).

```bash
npm install
npm run stack:start   # tải binary vào .stack/ lần đầu, chạy nền, ghi .env.local và .env.test
npm run db:reset      # tạo lại schema public, chạy supabase/migrations/*.sql rồi supabase/seed.sql
npx tsx scripts/create-staff.ts 0901234567 matkhau-admin admin   # tài khoản quản trị
npm run dev           # http://localhost:3000
npm run stack:stop    # dừng mọi tiến trình; dữ liệu Postgres giữ ở /tmp/wpb-pg
```

Log của từng dịch vụ ở `.stack/logs/` (Postgres: `/tmp/wpb-pg/postgres.log`).
Khoá anon/service role là JWT dev cố định — chỉ dùng cho máy local.
`db:reset` không xoá user trong Auth (bảng `auth.users`); xoá `/tmp/wpb-pg` (khi stack đã
dừng) để làm sạch toàn bộ dữ liệu, kể cả user Auth.

Nếu máy có Docker và Supabase CLI, có thể dùng `supabase start` thay cho stack trên (chép
URL/khoá mà CLI in ra vào `.env.local`, rồi `supabase db reset` để chạy migrations + seed).

## Kiểm thử

```bash
npm test           # unit (tests/unit)
npm run test:int   # integration (tests/integration) — cần stack đang chạy; tự chạy db:reset trước
npm run test:e2e   # Playwright — cần stack đang chạy
npm run lint
npm run build
```

`npm run test:int` cần DB mới reset (migrations + seed chuẩn) nên script tự chạy `npm run db:reset`
trước rồi mới chạy vitest — **xoá sạch dữ liệu local** mỗi lần chạy. Tham số thêm được chuyển cho
vitest, ví dụ `npm run test:int -- rls`.

`npm run test:e2e`:

- dùng Chrome cài sẵn trên máy (`channel: 'chrome'`), hai project: `desktop` và `mobile` (390×844);
- `tests/e2e/global-setup.ts` chạy `db:reset` và tạo tài khoản admin E2E (`0999000111`) — **xoá sạch
  dữ liệu local** mỗi lần chạy;
- tự `npm run build && npm run start` ở cổng 3000; nếu đã có server chạy ở cổng đó (ví dụ
  `npm run dev`) thì dùng luôn (trừ khi đặt biến `CI`);
- mỗi lần chạy đăng ký đối tác/khách bằng SĐT ngẫu nhiên (vì `auth.users` không bị reset).

## Triển khai lên môi trường thật

Khuyến nghị: Supabase (bản host, supabase.com) + Vercel.

### 1. Tạo dự án Supabase

1. Đăng ký supabase.com → **New project** (region Singapore cho gần Việt Nam). Ghi lại mật khẩu DB.
2. Chạy migrations **theo đúng thứ tự** `supabase/migrations/0001_schema.sql` → `0002_rls.sql` →
   `0003_functions.sql` → `0004_phone_check.sql` → `0005_product_details.sql`, chọn một trong ba cách:
   - **Một file gộp:** dán toàn bộ `supabase/setup-production.sql` vào SQL Editor, bấm *Run* — gồm
     migrations 0001–0005, dữ liệu sản phẩm/nhóm/bậc (giống `seed.sql`) và bucket ảnh `products`
     (khi đó bỏ qua bước 3 và 4); hoặc
   - **SQL Editor** trên dashboard: mở từng file, dán toàn bộ nội dung, bấm *Run*; hoặc
   - **Supabase CLI**:
     ```bash
     npx supabase login
     npx supabase init              # tạo supabase/config.toml (chỉ lần đầu)
     npx supabase link --project-ref <project-ref>
     npx supabase db push           # chạy các file trong supabase/migrations chưa chạy
     ```
3. (Tuỳ chọn) `supabase/seed.sql` là **dữ liệu khởi đầu** sinh từ `data/*.json` (6 nhóm, các sản
   phẩm phổ biến với giá tham khảo thị trường, 2 bậc đối tác). Muốn dùng thì chạy trong SQL Editor;
   nếu không, tự nhập nhóm/sản phẩm/bậc trong trang admin.
4. **Storage** → *New bucket* tên `products`, bật **Public bucket** (ảnh sản phẩm). Ứng dụng tự tạo
   bucket nếu chưa có, nhưng tạo sẵn để kiểm soát cấu hình.
5. **Authentication → Providers → Email**: giữ bật (đối tác đăng nhập bằng SĐT, nội bộ map thành
   email `<sdt>@partner.local`; tài khoản được tạo qua API quản trị nên không cần gửi email xác nhận).
6. **Project Settings → API**: lấy *Project URL*, khoá `anon` và khoá `service_role`.

Lưu ý gói: **Supabase Free tạm dừng dự án sau 7 ngày không có hoạt động** và không có backup
hằng ngày. Khi chạy kinh doanh thật nên dùng **Supabase Pro (~25 USD/tháng)**.

### Cập nhật dữ liệu sản phẩm

Bộ sản phẩm/nhóm gốc nằm ở `data/products.json` và `data/categories.json` (ảnh minh họa khai báo
trong `lib/media/images.ts`, nguồn ảnh ở [`docs/nguon-anh.md`](docs/nguon-anh.md)). Sửa JSON rồi chạy:

```bash
npm run data:gen   # kiểm tra dữ liệu (validateDataset) rồi sinh lại 3 file SQL bên dưới — không sửa tay
```

| File sinh ra | Dùng cho |
|---|---|
| `supabase/seed.sql` | local/test (`npm run db:reset` chạy sau migrations) |
| `supabase/setup-production.sql` | dự án Supabase **mới, trống**: migrations 0001–0005 + dữ liệu + bucket ảnh |
| `supabase/data-update-production.sql` | dự án **đang chạy** còn bộ 10 sản phẩm mẫu cũ (xem dưới) |

Dự án đang chạy từ trước bản giao diện mới: trong SQL Editor chạy **`0005_product_details.sql`**
trước (thêm cột thương hiệu, mô tả ngắn, thành phần, công dụng, cách dùng, cây trồng, nổi bật; slug
và ảnh nhóm — `if not exists` nên chạy lại không lỗi), **rồi** `data-update-production.sql`.

> **`data-update-production.sql` chỉ chạy MỘT LẦN**, để chuyển bộ sản phẩm mẫu cũ sang bộ dữ liệu
> thật. Nó gắn slug cho nhóm cũ, upsert nhóm/bậc/tỷ lệ/sản phẩm theo SKU, **ẩn** sản phẩm ngoài
> `data/products.json` đã có đơn và **XÓA** sản phẩm ngoài `data/products.json` chưa có đơn (kể cả
> sản phẩm admin tự thêm, kèm khuyến mãi theo sản phẩm đó). Sau khi cửa hàng đã thêm sản phẩm thật
> qua trang admin/Excel thì **không chạy lại** file này — sửa sản phẩm trong trang admin hoặc nhập Excel.

Giá trong `data/products.json` là **giá tham khảo thị trường** (số nguyên VNĐ); cửa hàng sửa lại theo
giá bán thực tế trong trang admin.

### 2. Biến môi trường

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | có | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | có | khoá `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | có | khoá `service_role` — **bí mật**, chỉ đặt ở server, không bao giờ để lộ ra trình duyệt |
| `NEXT_PUBLIC_SITE_NAME` | không | tên cửa hàng mặc định (sửa được trong *Cài đặt*) |
| `RESEND_API_KEY` | không | gửi email báo đơn mới qua resend.com |
| `NOTIFY_FROM_EMAIL` | không | địa chỉ gửi (domain đã xác minh trên Resend) |
| `TELEGRAM_BOT_TOKEN` | không | bot báo đơn mới; chat id nhập trong *Cài đặt* |

Mẫu: `.env.example`. Biến `NEXT_PUBLIC_*` được nhúng lúc build — đổi giá trị thì phải build/deploy lại.

### 3. Deploy lên Vercel

1. Đẩy mã nguồn lên GitHub → vercel.com → **Add New Project** → chọn repo (Framework: Next.js,
   giữ lệnh build mặc định `next build`).
2. Nhập các biến môi trường ở bảng trên (Production + Preview) → **Deploy**.
3. Gắn tên miền riêng trong *Settings → Domains*.

Lưu ý gói: **Vercel Hobby chỉ dành cho mục đích phi thương mại**. Khi kinh doanh thật dùng
**Vercel Pro (~20 USD/tháng)** hoặc chuyển sang **Cloudflare** (Workers, qua adapter OpenNext).

Giới hạn tần suất đặt đơn lẻ (theo IP) đọc IP khách từ header `x-forwarded-for`. Vercel tự đặt
header này đúng. Nếu tự host (VPS, Docker, sau Nginx/Cloudflare…), reverse proxy phải ghi đè
`x-forwarded-for` bằng IP thật của khách, nếu không giới hạn theo IP sẽ không đáng tin (giới hạn
theo SĐT vẫn chạy).

Tự host bằng `output: 'standalone'`: route ảnh bảng giá (`/bang-gia/anh`) đọc font `.woff` trong
`node_modules/@fontsource/be-vietnam-pro/files` theo thư mục làm việc. `next.config.ts` đã khai báo
`outputFileTracingIncludes` để bản standalone mang theo các file này; hãy chạy `node server.js`
**từ trong thư mục standalone**. Với `next start` thông thường thì chạy từ thư mục gốc dự án.

### 4. Tạo tài khoản quản trị

Chạy trên máy của bạn, trỏ tới dự án Supabase thật (biến môi trường có sẵn thì script không đọc
`.env.local`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role> \
npx tsx scripts/create-staff.ts 0901234567 <mat-khau-it-nhat-8-ky-tu> admin
```

Vai trò `staff` (nhân viên: xử lý đơn hàng và xem dữ liệu; sản phẩm, khuyến mãi, bậc, đối tác,
chi hoa hồng và *Cài đặt* chỉ dành cho `admin`) tạo cùng cách, thay `admin` bằng `staff`. Chạy lại với SĐT đã có sẽ đặt lại mật khẩu và vai trò.

Không chạy được script (chỉ có SQL Editor): đăng ký một tài khoản ở `/dang-ky` bằng SĐT của người
quản trị, rồi trong SQL Editor gắn vai trò và bỏ hồ sơ đối tác chờ duyệt vừa tạo (tài khoản Auth lưu
email nội bộ `<sdt>@partner.local`):

```sql
insert into public.staff (user_id, role)
select id, 'admin' from auth.users where email = '0901234567@partner.local'
on conflict (user_id) do update set role = excluded.role;
delete from public.partners
where user_id = (select id from auth.users where email = '0901234567@partner.local');
```

Sau đó đăng nhập ở `/dang-nhap` → vào *Cài đặt* nhập tên cửa hàng, thông tin chuyển khoản,
email/Telegram nhận thông báo.

### 5. Ứng dụng trên điện thoại (PWA)

`app/manifest.ts` khai báo ứng dụng mở thẳng `/doi-tac`. Đối tác mở trang bằng Chrome (Android)
hoặc Safari (iPhone) → *Thêm vào màn hình chính* để dùng như một ứng dụng.

## Chi phí ước tính

- Thử nghiệm: Supabase Free + Vercel Hobby = 0 đồng; tên miền vài trăm nghìn đồng/năm.
- Kinh doanh thật: Supabase Pro (~25 USD/tháng) + Vercel Pro (~20 USD/tháng) hoặc Cloudflare.
