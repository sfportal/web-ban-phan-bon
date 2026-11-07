# Web bán phân bón cho CTV

Next.js (App Router) + Supabase. Tài liệu thiết kế và kế hoạch nằm trong `docs/`.

## Chạy local

Không cần Docker hay Supabase CLI: `scripts/stack/` dựng một stack Supabase tối giản
(Postgres từ `embedded-postgres`, Supabase Auth/GoTrue, PostgREST và một gateway
Node ở `http://127.0.0.1:54321` phục vụ `/auth/v1` và `/rest/v1`). Không có Storage.

```bash
npm install
npm run stack:start   # tải binary vào .stack/ lần đầu, chạy nền, ghi .env.local và .env.test
npm run db:reset      # tạo lại schema public, chạy supabase/migrations/*.sql rồi supabase/seed.sql
npm run dev           # http://localhost:3000
npm run stack:stop    # dừng mọi tiến trình; dữ liệu Postgres giữ ở /tmp/wpb-pg
```

Log của từng dịch vụ ở `.stack/logs/` (Postgres: `/tmp/wpb-pg/postgres.log`).
Khoá anon/service role là JWT dev cố định — chỉ dùng cho máy local.
Xoá `/tmp/wpb-pg` (khi stack đã dừng) để làm sạch toàn bộ dữ liệu, kể cả user Auth.

## Kiểm thử

```bash
npm test           # unit (tests/unit)
npm run test:int   # integration (tests/integration) — cần stack đang chạy
npm run test:e2e   # Playwright, dùng Chrome cài sẵn (channel: chrome)
npm run build
```

Các biến môi trường cần có: xem `.env.example`.
