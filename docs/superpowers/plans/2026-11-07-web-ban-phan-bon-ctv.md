# Website bán phân bón cho CTV/đối tác — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây website bán phân bón/vật tư, nơi CTV hoa hồng và đại lý tự lên đơn trên điện thoại, hoa hồng/chiết khấu tính tự động, nông dân đặt lẻ không cần tài khoản.

**Architecture:** Một ứng dụng Next.js (App Router) với ba khu `/`, `/doi-tac`, `/admin`. Phép tính tiền nằm trong thư viện TypeScript thuần `lib/pricing` (dễ test). Mọi thao tác ghi đi qua Server Actions dùng service role và gọi hàm Postgres (RPC) để giữ tính nguyên tử. RLS của Supabase bảo vệ mọi thao tác đọc từ phiên người dùng.

**Tech Stack:** Next.js 15 + TypeScript + Tailwind CSS 4, Supabase (Postgres, Auth, Storage, `@supabase/ssr`), zod, exceljs, Vitest, Playwright, Supabase CLI (chạy local cần Docker).

**Spec:** `docs/superpowers/specs/2026-11-07-web-ban-phan-bon-ctv-design.md`

## Global Constraints

- Node ≥ 20. Giao diện tiếng Việt, tiền VNĐ, múi giờ `Asia/Ho_Chi_Minh` cho mọi hiển thị ngày giờ và mọi phép tính "tháng" (kỳ hoa hồng, mã đơn).
- Tiền lưu dạng số nguyên VNĐ (`bigint` trong DB, `number` nguyên trong TS). Tỷ lệ lưu `numeric(5,2)` (đơn vị %). Làm tròn đến đồng bằng `Math.round`.
- Hiển thị tiền: `new Intl.NumberFormat('vi-VN').format(n) + ' đ'`, dùng chung hàm `formatVnd` (Task 2).
- SĐT luôn qua `normalizePhone` trước khi lưu hoặc so khớp. Email nội bộ của đối tác: `<sdt>@partner.local`; người dùng không bao giờ thấy email này.
- Tên cửa hàng lấy từ biến `NEXT_PUBLIC_SITE_NAME` (mặc định `"Cửa hàng vật tư"`) hoặc từ setting `store_name` nếu đã cấu hình.
- Server không tin bất kỳ con số tiền/tỷ lệ nào do trình duyệt gửi lên.
- `SUPABASE_SERVICE_ROLE_KEY` chỉ được import trong file có `import 'server-only'`.
- Giao diện đối tác và cửa hàng thiết kế cho viewport 390×844 trước: chữ thân ≥ 16px, nút bấm cao ≥ 44px.
- Hàm RPC chỉ cấp quyền `execute` cho `service_role` (revoke khỏi `anon`, `authenticated`).

## Review Focus

1. **SĐT nhập nhiều dạng** (`+84 912 345 678`, `0912.345.678`, `84912345678`) phải ra cùng một khách. Dạng sai (`123`, chữ cái) bị từ chối với thông báo rõ ràng. → test ở Task 2.
2. **Khuyến mãi ở mốc biên và cấu hình lạ** (đúng lúc hết hạn theo giờ VN, giảm 100%, giá cố định cao hơn giá niêm yết) không bao giờ cho giá âm hoặc cao hơn giá niêm yết. → test ở Task 3.
3. **Bấm "Gửi đơn" hai lần hoặc mạng chập chờn gửi lại** chỉ tạo đúng một đơn. → test ở Task 5 (`create_order` idempotent) và Task 8.
4. **Bấm đúp khi đổi trạng thái** (`paid` hai lần, `returned` hai lần) không làm hoa hồng bị nhân đôi hoặc trừ hai lần. → test ở Task 5.
5. **File Excel sản phẩm "bẩn"** (giá ghi `350.000` hoặc `350,000`, ô trống, SKU trùng trong file, nhóm không tồn tại) phải báo lỗi theo từng dòng và không nhập nửa vời. → test ở Task 11.

---

## Cấu trúc file

```
app/
  layout.tsx, globals.css, manifest.ts
  (shop)/page.tsx                    # catalog công khai
  (shop)/san-pham/[id]/page.tsx
  (shop)/gio-hang/page.tsx           # giỏ + form đặt lẻ
  (shop)/dat-hang-thanh-cong/[code]/page.tsx
  bang-gia/page.tsx                  # bảng giá lẻ chia sẻ được
  bang-gia/anh/route.tsx             # ảnh PNG bảng giá (next/og)
  dang-nhap/page.tsx, dang-ky/page.tsx, cho-duyet/page.tsx
  doi-tac/layout.tsx, page.tsx       # trang chủ đối tác
  doi-tac/don-moi/page.tsx           # luồng lên đơn
  doi-tac/don-hang/page.tsx, [id]/page.tsx
  doi-tac/nong-dan/page.tsx
  doi-tac/hoa-hong/page.tsx
  admin/layout.tsx, page.tsx         # tổng quan
  admin/san-pham/..., admin/nhom/..., admin/bac-doi-tac/..., admin/khuyen-mai/...
  admin/doi-tac/..., admin/nong-dan/..., admin/don-hang/..., admin/don-hang/[id]/in/page.tsx
  admin/hoa-hong/..., admin/cai-dat/..., admin/xuat-du-lieu/route.ts
lib/
  phone.ts, format.ts
  pricing/types.ts, pricing/sale-price.ts, pricing/rates.ts, pricing/price-order.ts, pricing/index.ts
  orders/status.ts
  supabase/server.ts, supabase/browser.ts, supabase/admin.ts
  auth/guards.ts
  catalog/queries.ts                 # đọc sản phẩm, khuyến mãi, tier → kiểu của lib/pricing
  orders/submit.ts                   # server action gửi đơn
  orders/edit.ts
  notify/index.ts
  excel/products.ts, excel/export.ts
  draft/use-order-draft.ts
components/ (ui dùng chung: Button, Money, QtyStepper, StatusBadge…)
supabase/migrations/0001_schema.sql, 0002_rls.sql, 0003_functions.sql
supabase/seed.sql
scripts/create-staff.ts
tests/unit/*.test.ts
tests/integration/helpers.ts, tests/integration/*.test.ts
tests/e2e/*.spec.ts
docs/huong-dan-van-hanh.md, README.md
```

---

### Task 1: Khởi tạo dự án và công cụ

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `app/layout.tsx`, `app/globals.css`, `app/(shop)/page.tsx` (tạm hiển thị tên cửa hàng), `supabase/config.toml` (qua `supabase init`), `tests/unit/smoke.test.ts`, `.gitignore`

**Interfaces:**
- Produces: các script npm `dev`, `build`, `test` (vitest run tests/unit), `test:int` (vitest run tests/integration), `test:e2e` (playwright), `db:reset` (`supabase db reset`), `db:types` (`supabase gen types typescript --local > lib/supabase/database.types.ts`). Biến môi trường: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_NAME`, `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `TELEGRAM_BOT_TOKEN`.

- [ ] **Step 1:** `npx create-next-app@latest . --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*"`. Cài thêm `@supabase/supabase-js @supabase/ssr zod exceljs server-only` và dev deps `vitest @playwright/test supabase tsx`.
- [ ] **Step 2:** Viết `tests/unit/smoke.test.ts` với `expect(1 + 1).toBe(2)`. Chạy `npm test`. Kỳ vọng: 1 passed.
- [ ] **Step 3:** `npx supabase init`. Thêm `.env.example` liệt kê đủ các biến ở trên. `<html lang="vi">`, font Be Vietnam Pro qua `next/font/google`.
- [ ] **Step 4:** Chạy `npm run build`. Kỳ vọng: build thành công.
- [ ] **Step 5: Commit** — `chore: khởi tạo Next.js, Supabase, Vitest, Playwright`

---

### Task 2: Thư viện thuần: SĐT, định dạng tiền, trạng thái đơn

**Files:**
- Create: `lib/phone.ts`, `lib/format.ts`, `lib/orders/status.ts`
- Test: `tests/unit/phone.test.ts`, `tests/unit/status.test.ts`

**Interfaces:**
- Produces:
  - `normalizePhone(input: string): string | null`. Bỏ khoảng trắng, `.`, `-`, `(`, `)`. Đầu `+84` hoặc `84` (khi tổng dài 11–12 chữ số) đổi thành `0`. Hợp lệ khi khớp `/^0\d{9,10}$/`, ngược lại trả `null`.
  - `phoneToEmail(phone: string): string`. Trả `${normalizePhone(phone)}@partner.local`, throw `Error('invalid_phone')` nếu không hợp lệ.
  - `formatVnd(n: number): string`, ví dụ `"350.000 đ"`.
  - `type OrderStatus = 'new'|'confirmed'|'shipping'|'delivered'|'paid'|'cancelled'|'returned'`
  - `TRANSITIONS: Record<OrderStatus, OrderStatus[]>` = `new→[confirmed,cancelled]`, `confirmed→[shipping,cancelled]`, `shipping→[delivered,cancelled]`, `delivered→[paid,returned]`, `paid→[returned]`, `cancelled→[]`, `returned→[]`.
  - `canTransition(from: OrderStatus, to: OrderStatus, actor: 'partner'|'staff'): boolean`. Partner chỉ được `new→cancelled`.
  - `STATUS_LABEL: Record<OrderStatus,string>` = Mới, Đã xác nhận, Đang giao, Đã giao, Đã thu đủ tiền, Đã hủy, Trả hàng.

- [ ] **Step 1: Viết test lỗi**

```ts
test.each([
  ['0912345678', '0912345678'], ['+84 912 345 678', '0912345678'],
  ['84912345678', '0912345678'], ['0912.345.678', '0912345678'],
  ['(091) 234-5678', '0912345678'], ['02838123456', '02838123456'],
])('normalizePhone(%s)', (i, o) => expect(normalizePhone(i)).toBe(o))
test.each(['123', 'abc0912345678', '', '091234567890', '1912345678'])
  ('normalizePhone từ chối %s', i => expect(normalizePhone(i)).toBeNull())
test('phoneToEmail', () => expect(phoneToEmail('+84912345678')).toBe('0912345678@partner.local'))
test('phoneToEmail sai', () => expect(() => phoneToEmail('12')).toThrow('invalid_phone'))
test('formatVnd', () => expect(formatVnd(350000)).toBe('350.000 đ'))
test('partner chỉ hủy được đơn mới', () => {
  expect(canTransition('new','cancelled','partner')).toBe(true)
  expect(canTransition('new','confirmed','partner')).toBe(false)
  expect(canTransition('confirmed','cancelled','partner')).toBe(false)
})
test('staff theo sơ đồ', () => {
  expect(canTransition('delivered','paid','staff')).toBe(true)
  expect(canTransition('paid','returned','staff')).toBe(true)
  expect(canTransition('paid','cancelled','staff')).toBe(false)
  expect(canTransition('new','paid','staff')).toBe(false)
})
```

- [ ] **Step 2:** `npm test`. Kỳ vọng: FAIL vì các module chưa tồn tại.
- [ ] **Step 3:** Cài đặt ba file theo Interfaces.
- [ ] **Step 4:** `npm test`. Kỳ vọng: PASS. (Nếu `Intl` trả khoảng trắng không ngắt, thay bằng khoảng trắng thường trong `formatVnd`.)
- [ ] **Step 5: Commit** — `feat: chuẩn hóa SĐT, định dạng tiền, sơ đồ trạng thái đơn`

---

### Task 3: Thư viện tính giá `lib/pricing`

**Files:**
- Create: `lib/pricing/types.ts`, `lib/pricing/sale-price.ts`, `lib/pricing/rates.ts`, `lib/pricing/price-order.ts`, `lib/pricing/index.ts`
- Test: `tests/unit/pricing.test.ts`

**Interfaces:**
- Produces (export qua `@/lib/pricing`):

```ts
export type PromotionInput = { id: string; scope: 'product'|'category'; targetId: string;
  type: 'percent'|'fixed_price'; value: number; startsAt: Date; endsAt: Date; isActive: boolean }
export type ProductInput = { id: string; categoryId: string; listPrice: number; inStock: boolean; isActive: boolean }
export type TierInput = { kind: 'commission'|'wholesale'; byCategory: Record<string, number>; byProduct: Record<string, number> }
export type LineInput = { product: ProductInput; qty: number; farmerId: string | null }
export type PricedLine = { productId: string; farmerId: string | null; qty: number;
  listPriceSnap: number; salePriceSnap: number; promotionIdSnap: string | null; ratePctSnap: number;
  lineTotal: number; lineCommission: number; linePartnerPrice: number | null }
export type PricedOrder = { lines: PricedLine[]; subtotal: number; partnerPayable: number | null; commissionExpected: number }
export class PricingError extends Error {}
export function salePrice(p: ProductInput, promos: PromotionInput[], now: Date): { price: number; promotionId: string | null }
export function resolveRate(tier: TierInput, productId: string, categoryId: string): number
export function priceOrder(lines: LineInput[], promos: PromotionInput[], tier: TierInput | null, now: Date): PricedOrder
```

Quy tắc (theo spec mục 4):
- Khuyến mãi hiệu lực khi `isActive && startsAt <= now && now < endsAt`. Áp cho sản phẩm nếu `scope='product' && targetId=p.id` hoặc `scope='category' && targetId=p.categoryId`. `fixed_price` với scope category bị bỏ qua.
- Giá từ một khuyến mãi: percent → `Math.round(list*(1-value/100))`; fixed → `value`. Sau đó kẹp vào `[0, listPrice]`. Chọn giá thấp nhất. Nếu giá thấp nhất bằng giá niêm yết thì `promotionId = null`.
- `resolveRate`: `byProduct[productId] ?? byCategory[categoryId] ?? 0`.
- `tier = null` (đơn lẻ không chủ): rate 0, commission 0, `linePartnerPrice = null`, `partnerPayable = null`.
- `commission`: `lineCommission = Math.round(sale*qty*rate/100)`, `linePartnerPrice = null`, `partnerPayable = null`.
- `wholesale`: `linePartnerPrice = Math.round(sale*(1-rate/100))` (đơn giá), `lineCommission = 0`, `partnerPayable = Σ linePartnerPrice*qty`.
- `lineTotal = sale*qty`. `subtotal = Σ lineTotal`. `commissionExpected = Σ lineCommission`.
- `qty` không phải số nguyên ≥ 1, hoặc `lines` rỗng → `throw new PricingError('invalid_qty' | 'empty_order')`.

- [ ] **Step 1: Viết test lỗi** (dùng `const now = new Date('2026-11-10T03:00:00Z')`, product `P1` thuộc `NPK`, giá niêm yết 350000)

```ts
test('không khuyến mãi', () => expect(salePrice(P1, [], now)).toEqual({ price: 350000, promotionId: null }))
test('giảm 10% theo nhóm', () => expect(salePrice(P1, [promo({scope:'category',targetId:'NPK',type:'percent',value:10})], now).price).toBe(315000))
test('chọn khuyến mãi tốt nhất', () => {
  const r = salePrice(P1, [promo({id:'a',type:'percent',value:5}), promo({id:'b',type:'fixed_price',value:300000})], now)
  expect(r).toEqual({ price: 300000, promotionId: 'b' })
})
test('fixed_price cao hơn niêm yết bị kẹp, không tính là khuyến mãi', () =>
  expect(salePrice(P1, [promo({type:'fixed_price',value:400000})], now)).toEqual({ price: 350000, promotionId: null }))
test('giảm 100% ra 0, không âm', () => expect(salePrice(P1, [promo({type:'percent',value:100})], now).price).toBe(0))
test('hết hạn đúng tại endsAt (0h giờ VN)', () => {
  const p = promo({type:'percent',value:10, endsAt: new Date('2026-11-10T17:00:00Z')})
  expect(salePrice(P1, [p], new Date('2026-11-10T16:59:59Z')).price).toBe(315000)
  expect(salePrice(P1, [p], new Date('2026-11-10T17:00:00Z')).price).toBe(350000)
})
test('fixed_price theo nhóm bị bỏ qua', () =>
  expect(salePrice(P1, [promo({scope:'category',targetId:'NPK',type:'fixed_price',value:1})], now).price).toBe(350000))
test('resolveRate ưu tiên sản phẩm', () => {
  const t = { kind:'commission', byCategory:{NPK:5}, byProduct:{P1:7} } as const
  expect(resolveRate(t,'P1','NPK')).toBe(7); expect(resolveRate(t,'P2','NPK')).toBe(5); expect(resolveRate(t,'P3','HC')).toBe(0)
})
test('CTV: hoa hồng 5% trên 3 bao', () => {
  const o = priceOrder([{product:P1, qty:3, farmerId:'F1'}], [], {kind:'commission',byCategory:{NPK:5},byProduct:{}}, now)
  expect(o).toMatchObject({ subtotal: 1050000, commissionExpected: 52500, partnerPayable: null })
  expect(o.lines[0]).toMatchObject({ farmerId:'F1', ratePctSnap:5, linePartnerPrice:null })
})
test('Đại lý: chiết khấu 8% trên giá đã khuyến mãi', () => {
  const o = priceOrder([{product:P1, qty:2, farmerId:null}], [promo({type:'percent',value:10})], {kind:'wholesale',byCategory:{NPK:8},byProduct:{}}, now)
  expect(o.lines[0]).toMatchObject({ salePriceSnap: 315000, linePartnerPrice: 289800, lineCommission: 0 })
  expect(o).toMatchObject({ subtotal: 630000, partnerPayable: 579600, commissionExpected: 0 })
})
test('làm tròn hoa hồng', () =>
  expect(priceOrder([{product:{...P1,listPrice:33333},qty:1,farmerId:null}],[], {kind:'commission',byCategory:{NPK:2.5},byProduct:{}}, now).commissionExpected).toBe(833))
test('đơn lẻ không chủ', () => expect(priceOrder([{product:P1,qty:1,farmerId:null}], [], null, now)).toMatchObject({commissionExpected:0, partnerPayable:null}))
test.each([0, -1, 1.5])('qty %s không hợp lệ', q => expect(() => priceOrder([{product:P1,qty:q,farmerId:null}],[],null,now)).toThrow(PricingError))
test('đơn rỗng', () => expect(() => priceOrder([],[],null,now)).toThrow('empty_order'))
```

- [ ] **Step 2:** `npm test -- pricing`. Kỳ vọng: FAIL vì module chưa tồn tại.
- [ ] **Step 3:** Cài đặt theo Interfaces và quy tắc.
- [ ] **Step 4:** `npm test -- pricing`. Kỳ vọng: PASS toàn bộ.
- [ ] **Step 5: Commit** — `feat: thư viện tính giá, chiết khấu, hoa hồng`

---

### Task 4: Lược đồ CSDL, RLS, seed

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `supabase/migrations/0002_rls.sql`, `supabase/seed.sql`, `lib/supabase/database.types.ts` (sinh tự động), `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/admin.ts`, `tests/integration/helpers.ts`
- Test: `tests/integration/rls.test.ts`

**Interfaces:**
- Produces:
  - Các bảng theo spec mục 3, cộng thêm:
    - `orders.client_key uuid unique` (idempotency), `orders.client_ip text`, `orders.total_qty int`.
    - `commission_entries.kind text check (kind in ('earn','reversal'))` với `unique(order_id, kind)`.
    - `farmer_transfer_log(farmer_id, from_partner_id, to_partner_id, changed_by, changed_at)`.
    - `order_counters(period text primary key, last int)`.
    - `settings(key text primary key, value jsonb)` với các key `store_name`, `bank_info`, `notify_email`, `telegram_chat_id`.
    - `farmers.phone`, `partners.phone`: `unique` và `check (phone ~ '^0[0-9]{9,10}$')`. `products.sku unique`.
    - Kiểu enum Postgres `order_status` với đúng 7 giá trị ở Task 2.
  - Hàm SQL trợ giúp (security definer, stable): `current_partner_id() returns uuid` (chỉ trả khi status `active`), `is_staff() returns boolean`, `is_admin() returns boolean`.
  - Policy (chỉ cho SELECT; không có policy INSERT/UPDATE/DELETE cho `anon`/`authenticated`):
    - `anon` và mọi người: `categories`, `products where is_active`, `promotions where is_active`.
    - Partner: `orders`/`order_lines`/`commission_entries` của `current_partner_id()`; `farmers where owner_partner_id = current_partner_id()`; `partners where id = current_partner_id()` (cộng hàng của chính user kể cả khi pending, để hiện trang chờ duyệt); `partner_tiers`, `tier_rates`, `tier_product_rates` chỉ của bậc mình.
    - Staff: đọc tất cả. `settings`: staff đọc; `anon` chỉ đọc key `store_name`, `bank_info`, `zalo_link`.
  - `lib/supabase/server.ts`: `createServerClient(): SupabaseClient<Database>` (cookie, phiên người dùng). `lib/supabase/browser.ts`: `createBrowserClient()`. `lib/supabase/admin.ts` (`server-only`): `adminClient()` (service role).
  - `tests/integration/helpers.ts`: `adminClient()`, `createPartner(opts: {kind:'commission'|'wholesale'; status?: 'pending'|'active'|'locked'; phone?: string}): Promise<{partnerId: string; userId: string; phone: string; client: SupabaseClient}>` (client đã đăng nhập), `createStaff(role:'admin'|'staff')` (cùng dạng trả về), `resetData()`.
  - `seed.sql`: 5 nhóm (Phân NPK, Phân hữu cơ, Phân bón lá, Thuốc BVTV, Vật tư), khoảng 10 sản phẩm mẫu, 2 bậc (`CTV chuẩn` commission, `Đại lý cấp 1` wholesale) kèm tỷ lệ theo nhóm.

- [ ] **Step 1: Viết test lỗi** `tests/integration/rls.test.ts` (chạy sau `supabase start && npm run db:reset`):

```ts
test('CTV A không đọc được đơn/nông dân/hoa hồng của CTV B', async () => {
  const a = await createPartner({kind:'commission'}); const b = await createPartner({kind:'commission'})
  const orderB = await insertOrderFor(b.partnerId)   // helper dùng adminClient
  expect((await a.client.from('orders').select().eq('id', orderB)).data).toEqual([])
  expect((await a.client.from('farmers').select().eq('owner_partner_id', b.partnerId)).data).toEqual([])
})
test('đại lý không đọc tỷ lệ của bậc khác', async () => {
  const d = await createPartner({kind:'wholesale'})
  const { data } = await d.client.from('tier_rates').select('tier_id')
  expect(new Set(data!.map(r => r.tier_id)).size).toBe(1)
})
test('đối tác pending không đọc được giá theo bậc', async () => {
  const p = await createPartner({kind:'commission', status:'pending'})
  expect((await p.client.from('tier_rates').select()).data).toEqual([])
})
test('partner không ghi trực tiếp được', async () => {
  const a = await createPartner({kind:'commission'})
  expect((await a.client.from('orders').insert({ source:'partner' } as any)).error).not.toBeNull()
  expect((await a.client.from('products').update({ list_price: 1 }).neq('id','')).count ?? 0).toBe(0)
})
test('anon chỉ thấy sản phẩm đang bán', async () => { /* ẩn 1 SP bằng adminClient, anon select không thấy SP đó */ })
test('anon không đọc settings notify_email', async () => { /* anon select key notify_email → [] */ })
```

- [ ] **Step 2:** `npm run test:int -- rls`. Kỳ vọng: FAIL (chưa có bảng).
- [ ] **Step 3:** Viết `0001_schema.sql`, `0002_rls.sql`, `seed.sql`, helpers, ba file client Supabase. Chạy `npm run db:reset && npm run db:types`.
- [ ] **Step 4:** `npm run test:int -- rls`. Kỳ vọng: PASS.
- [ ] **Step 5: Commit** — `feat: lược đồ CSDL, RLS, dữ liệu mẫu`

---

### Task 5: Hàm Postgres cho đơn, trạng thái, hoa hồng, nông dân

**Files:**
- Create: `supabase/migrations/0003_functions.sql`
- Test: `tests/integration/order-functions.test.ts`, `tests/integration/farmers.test.ts`

**Interfaces:**
- Consumes: bảng của Task 4; `TRANSITIONS` của Task 2 (để test đối chiếu).
- Produces (tất cả chỉ `service_role` được execute):
  - `create_order(p_order jsonb, p_lines jsonb) returns table(id uuid, code text)`. `p_order` gồm các khóa: `source, partner_id, client_key, client_ip, delivery_address, payment_method, retail_name, retail_phone, retail_address, note, subtotal, partner_payable, commission_expected`. `p_lines` là mảng các object khóa snake_case đúng tên cột `order_lines`. Nếu `client_key` đã tồn tại thì trả về đơn cũ, không tạo mới. Mã đơn có dạng `DH` + `YYMM` theo giờ VN + `-` + số thứ tự 4 chữ số trong tháng (`order_counters`), ví dụ `DH2611-0001`. Ghi log trạng thái ban đầu `null→new`.
  - `change_order_status(p_order_id uuid, p_to order_status, p_actor uuid, p_actor_kind text, p_note text) returns void`. Khóa dòng bằng `for update`. Nếu trạng thái hiện tại đã bằng `p_to` thì không làm gì. Nếu chuyển không hợp lệ (cùng bảng với `TRANSITIONS`; `p_actor_kind='partner'` chỉ được `new→cancelled`) thì `raise exception 'invalid_transition'`. Khi `→paid` và `commission_expected > 0`: insert `commission_entries(kind='earn', amount=commission_expected, period=to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYYY-MM'), status='pending')`. Khi `→returned` và đã có `earn`: insert `kind='reversal', amount=-earn.amount` vào kỳ hiện tại. `on conflict (order_id, kind) do nothing`. Ghi `order_status_log`.
  - `replace_order_lines(p_order_id uuid, p_lines jsonb, p_totals jsonb, p_actor uuid, p_actor_kind text) returns void`. Partner chỉ sửa được khi `new`, staff khi `new|confirmed`; ngoài ra `raise 'not_editable'`.
  - `claim_farmer(p_partner_id uuid, p_phone text, p_name text, p_address text) returns jsonb`. Kết quả `{status:'ok', farmer_id}` nếu SĐT mới, chưa có chủ (gán chủ), hoặc đã thuộc chính CTV này. Kết quả `{status:'owned_by_other'}` nếu đã thuộc CTV khác (không trả tên CTV kia). Dùng `insert … on conflict (phone) do nothing` rồi `select … for update` để an toàn khi hai CTV gửi cùng lúc.
  - `transfer_farmer(p_farmer_id uuid, p_to_partner uuid, p_actor uuid) returns void`. Ghi `farmer_transfer_log`.
  - `retail_recent_count(p_phone text, p_ip text) returns int`. Số đơn `source='retail'` cùng SĐT hoặc cùng IP trong 10 phút gần nhất.

- [ ] **Step 1: Viết test lỗi**

```ts
test('mã đơn tăng dần theo tháng', async () => {
  const a = await createOrderRpc(); const b = await createOrderRpc()
  expect(a.code).toMatch(/^DH\d{4}-0001$/); expect(b.code).toMatch(/-0002$/)
})
test('cùng client_key trả về cùng đơn', async () => {
  const k = crypto.randomUUID()
  const [x, y] = await Promise.all([createOrderRpc({client_key:k}), createOrderRpc({client_key:k})])
  expect(x.id).toBe(y.id); expect(await countOrders()).toBe(1)
})
test('SQL khớp TRANSITIONS', async () => {
  for (const from of ALL) for (const to of ALL) for (const kind of ['partner','staff'] as const) {
    const id = await orderInStatus(from)
    const { error } = await rpc('change_order_status', {p_order_id:id, p_to:to, p_actor:actor, p_actor_kind:kind, p_note:null})
    expect(error === null).toBe(from === to || canTransition(from, to, kind))
  }
})
test('paid tạo hoa hồng một lần dù gọi hai lần', async () => {
  const id = await orderInStatus('delivered', {commission_expected: 52500})
  await toStatus(id,'paid'); await toStatus(id,'paid')
  expect(await commissions(id)).toEqual([{kind:'earn', amount:52500, status:'pending'}])
})
test('trả hàng sau paid tạo dòng âm một lần', async () => {
  const id = await orderInStatus('paid', {commission_expected: 52500})
  await toStatus(id,'returned'); await toStatus(id,'returned')
  expect((await commissions(id)).map(c => c.amount).sort()).toEqual([-52500, 52500])
})
test('hủy và trả hàng trước paid không có hoa hồng', async () => { /* new→cancelled; delivered→returned → [] */ })
test('đơn commission_expected = 0 không tạo dòng hoa hồng', async () => { /* đại lý */ })
test('mỗi lần đổi trạng thái đều ghi log', async () => { /* đếm order_status_log */ })
test('replace_order_lines: partner bị chặn khi confirmed, staff được', async () => { /* lỗi not_editable cho partner */ })
// farmers.test.ts
test('CTV khác nhập trùng SĐT bị chặn', async () => {
  expect((await claim(a, '0912345678')).status).toBe('ok')
  expect(await claim(b, '0912345678')).toEqual({ status: 'owned_by_other' })
})
test('khách chưa có chủ (từ đơn lẻ) được gán cho CTV đầu tiên', async () => { /* insert farmer owner null → claim ok, owner = a */ })
test('hai CTV claim song song chỉ một người thắng', async () => {
  const r = await Promise.all([claim(a,'0987654321'), claim(b,'0987654321')])
  expect(r.filter(x => x.status === 'ok')).toHaveLength(1)
})
test('transfer_farmer đổi chủ và ghi log', async () => { /* … */ })
test('retail_recent_count đếm theo SĐT hoặc IP trong 10 phút', async () => { /* … */ })
```

- [ ] **Step 2:** `npm run test:int -- order-functions farmers`. Kỳ vọng: FAIL (hàm chưa tồn tại).
- [ ] **Step 3:** Viết `0003_functions.sql`. Chạy `npm run db:reset && npm run db:types`.
- [ ] **Step 4:** `npm run test:int`. Kỳ vọng: PASS toàn bộ (gồm cả RLS).
- [ ] **Step 5: Commit** — `feat: hàm tạo đơn, đổi trạng thái, hoa hồng, khóa khách`

---

### Task 6: Đăng ký, đăng nhập, phân quyền

**Files:**
- Create: `lib/auth/guards.ts`, `lib/auth/actions.ts`, `middleware.ts`, `app/dang-nhap/page.tsx`, `app/dang-ky/page.tsx`, `app/cho-duyet/page.tsx`, `app/doi-tac/layout.tsx`, `app/admin/layout.tsx`, `scripts/create-staff.ts`
- Test: `tests/integration/auth.test.ts`

**Interfaces:**
- Consumes: `normalizePhone`, `phoneToEmail` (Task 2); `adminClient`, `createServerClient` (Task 4).
- Produces:
  - `type PartnerSession = { userId: string; partnerId: string; kind: 'commission'|'wholesale'; tierId: string; name: string; deliveryAddress: string }`
  - `requirePartner(): Promise<PartnerSession>`. Chưa đăng nhập thì `redirect('/dang-nhap')`. `pending` thì `redirect('/cho-duyet')`. `locked` thì đăng xuất rồi `redirect('/dang-nhap?locked=1')`.
  - `requireStaff(min?: 'staff'|'admin'): Promise<{ userId: string; role: 'admin'|'staff' }>`. Không đủ quyền thì `redirect('/')`.
  - `registerPartner(form: FormData): Promise<{ ok: true } | { error: 'invalid_phone'|'phone_taken'|'weak_password'|'missing_fields' }>`. Trường bắt buộc: phone, name, region, delivery_address, password (≥ 8 ký tự). Tạo user bằng `auth.admin.createUser({ email: phoneToEmail(phone), password, email_confirm: true })`, insert `partners` với status `pending` (lỗi giữa chừng thì xóa user vừa tạo), rồi đăng nhập.
  - `login(form: FormData): Promise<{ error: 'invalid_credentials' } | never>`. Thành công: staff → `/admin`, partner → `/doi-tac`.
  - `logout(): Promise<never>`
  - `scripts/create-staff.ts`: `npx tsx scripts/create-staff.ts <phone> <password> <admin|staff>`.
  - Bổ sung vào `tests/integration/helpers.ts`: `asUser<T>(u: { client: SupabaseClient } | null, fn: () => Promise<T>): Promise<T>`. Hàm dùng `vi.mock` thay `createServerClient` bằng `u.client` (`null` = anon) và giả lập `cookies()`/`headers()` của `next/headers` (header `x-forwarded-for` lấy từ tham số tùy chọn), để gọi Server Action trực tiếp trong test. `redirect()` được bắt thành lỗi `NEXT_REDIRECT` có thể assert.
  - Thông báo lỗi tiếng Việt: "Số điện thoại không hợp lệ", "Số điện thoại đã được đăng ký", "Mật khẩu cần ít nhất 8 ký tự", "Sai số điện thoại hoặc mật khẩu", "Tài khoản đã bị khóa, vui lòng liên hệ cửa hàng".

- [ ] **Step 1: Viết test lỗi** (gọi `registerPartner` và `login` qua `asUser(null, …)`):

```ts
test('đăng ký bằng SĐT dạng +84 tạo partner pending với SĐT chuẩn hóa', async () => {
  expect(await registerPartner(fd({phone:'+84 912 000 111', name:'Anh Ba', region:'Đắk Lắk', delivery_address:'Buôn Ma Thuột', password:'12345678'}))).toEqual({ok:true})
  expect(await partnerByPhone('0912000111')).toMatchObject({ status:'pending' })
})
test('đăng ký trùng SĐT', async () => { /* lần 2 → { error:'phone_taken' } */ })
test('SĐT sai, mật khẩu ngắn, thiếu trường', async () => { /* ba mã lỗi tương ứng */ })
test('đăng nhập sai mật khẩu', async () => expect(await login(fd({phone:'0912000111', password:'x'}))).toEqual({error:'invalid_credentials'}))
```

- [ ] **Step 2:** `npm run test:int -- auth`. Kỳ vọng: FAIL.
- [ ] **Step 3:** Cài đặt guards, actions, middleware (chỉ làm mới phiên Supabase), các trang form (di động, tiếng Việt), hai layout gọi guard, script tạo staff.
- [ ] **Step 4:** `npm run test:int -- auth` → PASS. Kiểm tra tay bằng `npm run dev`: mở `/doi-tac` khi chưa đăng nhập phải chuyển về `/dang-nhap`; tài khoản pending vào `/cho-duyet`.
- [ ] **Step 5: Commit** — `feat: đăng ký/đăng nhập bằng SĐT, phân quyền đối tác và admin`

---

### Task 7: Đọc dữ liệu catalog và cửa hàng công khai

**Files:**
- Create: `lib/catalog/queries.ts`, `components/ProductCard.tsx`, `components/Money.tsx`, `components/QtyStepper.tsx`, `app/(shop)/page.tsx`, `app/(shop)/san-pham/[id]/page.tsx`, `app/(shop)/gio-hang/page.tsx` (chỉ phần giỏ; form đặt ở Task 8), `lib/cart/use-cart.ts`
- Test: `tests/integration/catalog.test.ts`

**Interfaces:**
- Consumes: kiểu `ProductInput`, `PromotionInput`, `TierInput`, `salePrice` (Task 3).
- Produces:
  - `type CatalogProduct = ProductInput & { sku: string; name: string; unit: string; imageUrl: string | null; description: string | null; categoryName: string; updatedPriceAt: Date }`
  - `getCatalog(db: SupabaseClient): Promise<{ products: CatalogProduct[]; categories: {id:string;name:string}[]; promos: PromotionInput[] }>`. Chỉ lấy sản phẩm `is_active`, sắp theo nhóm rồi tên.
  - `getProductsByIds(db, ids: string[]): Promise<CatalogProduct[]>`. Lấy cả sản phẩm không active, để server phát hiện sản phẩm bị ẩn.
  - `getTier(db, tierId: string): Promise<TierInput>`
  - `useCart()` (client): `{ items: {productId:string; qty:number}[]; add(id,qty); setQty(id,qty); remove(id); clear() }`. Lưu `localStorage` key `cart:v1`, bọc try/catch; lỗi thì giữ trong bộ nhớ.
  - Trang chủ cửa hàng: ô tìm kiếm, tab nhóm, thẻ sản phẩm có giá bán và giá gạch nếu có khuyến mãi, nhãn "Hết hàng" (không cho thêm vào giỏ), nút nổi "Giỏ hàng (n)", nút "Chat Zalo" (link từ setting `zalo_link` nếu có).

- [ ] **Step 1: Viết test lỗi:** `getCatalog` với client anon không trả sản phẩm ẩn; `getTier` trả đúng `byCategory`/`byProduct` của bậc trong seed; `getCatalog` chỉ trả khuyến mãi `is_active`.
- [ ] **Step 2:** `npm run test:int -- catalog` → FAIL.
- [ ] **Step 3:** Cài đặt queries, hook giỏ hàng, các trang và component.
- [ ] **Step 4:** `npm run test:int -- catalog` → PASS. Kiểm tra tay `npm run dev` ở viewport 390px: thêm vào giỏ, tải lại trang giỏ vẫn còn.
- [ ] **Step 5: Commit** — `feat: catalog công khai và giỏ hàng`

---

### Task 8: Server action gửi đơn và thông báo

**Files:**
- Create: `lib/orders/submit.ts`, `lib/notify/index.ts`, `app/(shop)/gio-hang/RetailForm.tsx`, `app/(shop)/dat-hang-thanh-cong/[code]/page.tsx`
- Test: `tests/integration/submit.test.ts`, `tests/unit/notify.test.ts`

**Interfaces:**
- Consumes: `asUser` (Task 6, cho test); `priceOrder`, `PricingError` (Task 3); `getProductsByIds`, `getCatalog`, `getTier` (Task 7); `create_order`, `claim_farmer`, `retail_recent_count` (Task 5); `requirePartner` (Task 6); `normalizePhone` (Task 2).
- Produces:

```ts
type SeenLine = { productId: string; qty: number; farmerId: string | null; seenSalePrice: number }
type Change = { productId: string; field: 'price'|'stock'|'inactive'; old: number|boolean; new: number|boolean }
type SubmitResult =
  | { status: 'ok'; orderId: string; code: string }
  | { status: 'changed'; changes: Change[] }           // CTV phải xác nhận lại
  | { status: 'error'; error: 'empty_order'|'invalid_qty'|'unavailable'|'invalid_phone'|'rate_limited'|'farmer_not_owned'|'missing_fields' }
submitPartnerOrder(input: { clientKey: string; lines: SeenLine[]; deliveryAddress: string; note?: string; acceptChanges: boolean }): Promise<SubmitResult>
submitRetailOrder(input: { clientKey: string; lines: Omit<SeenLine,'farmerId'>[]; name: string; phone: string; address: string; paymentMethod: 'cod'|'transfer'; note?: string; honeypot?: string }): Promise<SubmitResult>
notifyNewOrder(order: { code: string; source: 'partner'|'retail'; partnerName: string | null; subtotal: number }): Promise<void>
```

Quy tắc:
- Server tải lại sản phẩm, khuyến mãi và bậc từ DB rồi tính bằng `priceOrder` với `now = new Date()`.
- Sản phẩm `inactive` hoặc hết hàng → luôn trả `changed` với field tương ứng. Nếu chỉ khác giá và `acceptChanges=false` → trả `changed`. Nếu `acceptChanges=true` mà vẫn còn dòng hết hàng/ẩn → trả `error: 'unavailable'`.
- Đơn CTV: mọi `farmerId` phải thuộc `partnerId` hiện tại, ngược lại trả `farmer_not_owned`. Đơn đại lý: `farmerId` phải là `null`.
- Đơn lẻ: `honeypot` khác rỗng → trả `ok` giả (không tạo đơn). `retail_recent_count ≥ 3` → `rate_limited`. Nếu SĐT trùng `farmers` có chủ → `partner_id` = chủ, tính theo bậc của chủ. Nếu SĐT chưa có trong `farmers` → tạo farmer không chủ. IP lấy từ header `x-forwarded-for`.
- `notifyNewOrder`: gửi email qua Resend (`fetch` tới `https://api.resend.com/emails`) nếu có `RESEND_API_KEY` và setting `notify_email`; gửi Telegram `sendMessage` nếu có `TELEGRAM_BOT_TOKEN` và `telegram_chat_id`. Mọi lỗi chỉ `console.error`, không làm hỏng việc gửi đơn. Gọi sau khi tạo đơn, không chặn phản hồi (`after()` của Next).
- Trang thành công hiển thị mã đơn, tổng tiền, thông tin chuyển khoản từ setting `bank_info` khi chọn chuyển khoản. Dòng chữ cố định: "Cửa hàng sẽ gọi điện xác nhận đơn trong giờ làm việc."

- [ ] **Step 1: Viết test lỗi**

```ts
test('CTV gửi đơn 2 nông dân, server tự tính hoa hồng', async () => {
  const r = await asUser(ctv, () => submitPartnerOrder({clientKey:k(), lines:[l(P1,3,F1,350000), l(P2,1,F2,120000)], deliveryAddress:'x', acceptChanges:false}))
  expect(r.status).toBe('ok'); expect(await order(r)).toMatchObject({ commission_expected: expected })
})
test('giá trình duyệt gửi lên bị bỏ qua: giá đổi → changed', async () => {
  const r = await asUser(ctv, () => submitPartnerOrder({clientKey:k(), lines:[l(P1,1,F1,1)], deliveryAddress:'x', acceptChanges:false}))
  expect(r).toEqual({ status:'changed', changes:[{productId:P1, field:'price', old:1, new:350000}] })
})
test('acceptChanges=true thì tạo đơn theo giá server', async () => { /* … ok, sale_price_snap = 350000 */ })
test('sản phẩm hết hàng không gửi được kể cả khi acceptChanges', async () => { /* changed, rồi error unavailable */ })
test('gửi lại cùng clientKey ra cùng đơn', async () => { /* hai lần → cùng orderId */ })
test('farmerId của CTV khác → farmer_not_owned', async () => {})
test('đơn lẻ có SĐT thuộc CTV → tính hoa hồng cho CTV đó', async () => {})
test('đơn lẻ lần thứ 4 trong 10 phút → rate_limited', async () => {})
test('honeypot có giá trị → không tạo đơn', async () => {})
// notify.test.ts
test('thiếu cấu hình thì không gọi fetch', async () => { /* mock fetch, expect not called */ })
test('fetch lỗi không throw', async () => { /* mock fetch reject → resolves */ })
```

- [ ] **Step 2:** `npm run test:int -- submit && npm test -- notify` → FAIL.
- [ ] **Step 3:** Cài đặt `submit.ts`, `notify/index.ts`, form đặt lẻ (tên, SĐT, địa chỉ, COD/chuyển khoản, ô honeypot ẩn, nút gửi bị khóa khi đang gửi) và trang thành công.
- [ ] **Step 4:** Chạy lại hai lệnh trên → PASS.
- [ ] **Step 5: Commit** — `feat: gửi đơn CTV/đại lý/đơn lẻ, phát hiện đổi giá, thông báo`

---

### Task 9: Luồng lên đơn của đối tác (di động)

**Files:**
- Create: `lib/draft/use-order-draft.ts`, `lib/farmers/actions.ts`, `lib/orders/frequent.ts`, `app/doi-tac/don-moi/page.tsx`, `app/doi-tac/don-moi/FarmerPicker.tsx`, `app/doi-tac/don-moi/ProductPicker.tsx`, `app/doi-tac/don-moi/ConfirmStep.tsx`
- Test: `tests/unit/draft.test.ts`, `tests/integration/farmer-actions.test.ts`

**Interfaces:**
- Consumes: `submitPartnerOrder`, `SubmitResult`, `Change` (Task 8); `getCatalog`, `getTier` (Task 7); `salePrice`, `resolveRate`, `priceOrder` (Task 3, để hiển thị tạm phía client); `claim_farmer` (Task 5); `requirePartner` (Task 6).
- Produces:
  - `type OrderDraft = { clientKey: string; groups: { farmerId: string | null; farmerName: string; items: { productId: string; qty: number }[] }[]; deliveryAddress: string; note: string }`
  - `useOrderDraft(partnerId: string, initial?: OrderDraft)` trả `{ draft, addGroup(farmer), setQty(groupIdx, productId, qty), removeGroup(idx), setDelivery(s), setNote(s), reset() }`. Lưu `localStorage` key `draft:v1:<partnerId>`, bọc try/catch. `clientKey` tạo bằng `crypto.randomUUID()` khi bắt đầu draft và chỉ đổi sau `reset()`.
  - Hàm thuần `draftToLines(draft, priceOf: (id:string)=>number): SeenLine[]` (export để test).
  - `addFarmer(form: {phone; name; address?}): Promise<{status:'ok'; farmer:{id;name;phone}} | {status:'owned_by_other'} | {status:'invalid_phone'}>`
  - `searchMyFarmers(q: string): Promise<{id;name;phone}[]>`. Tìm theo SĐT hoặc tên, tối đa 20 kết quả.
  - `getFrequentProducts(partnerId: string): Promise<string[]>`. Top 10 `product_id` theo tổng qty, mọi thời gian, bỏ đơn `cancelled`.
  - Trang `?tu-don=<orderId>` ("Đặt lại"): nạp các dòng của đơn cũ vào draft mới (giá hiện tại).
- Hành vi giao diện:
  - CTV commission: bước 1 chọn nông dân, bước 2 chọn sản phẩm (tab "Hay đặt", tìm kiếm, lọc nhóm, `QtyStepper`, hiện giá bán và "HH: x đ/đv"), nút "+ Nông dân khác", bước 3 xác nhận (tổng theo từng nông dân, tổng đơn, "Hoa hồng dự kiến").
  - Đại lý: bỏ bước 1, chỉ có một nhóm `farmerId=null`. Xác nhận hiện "Tổng theo giá niêm yết", "Bạn trả", "Tiết kiệm".
  - Khi nhận `changed`: tô vàng các dòng thay đổi, hiện giá cũ → mới, nút "Đồng ý và gửi lại" (gửi `acceptChanges: true`). Khi `owned_by_other`: hiện "Khách này đã thuộc CTV khác, vui lòng liên hệ cửa hàng".
  - Thành công: `reset()` draft, chuyển tới `/doi-tac/don-hang/<id>`.

- [ ] **Step 1: Viết test lỗi:** `draftToLines` gộp đúng `farmerId` theo nhóm, bỏ item qty 0; `useOrderDraft` giữ nguyên `clientKey` qua lần nạp lại từ storage và đổi `clientKey` sau `reset()` (test với `localStorage` giả của jsdom; storage throw thì vẫn chạy được). Integration: `addFarmer` với SĐT của CTV khác → `owned_by_other`; `searchMyFarmers` không trả khách của CTV khác; `getFrequentProducts` bỏ đơn hủy.
- [ ] **Step 2:** `npm test -- draft && npm run test:int -- farmer-actions` → FAIL.
- [ ] **Step 3:** Cài đặt hook, actions, các bước giao diện.
- [ ] **Step 4:** Chạy lại → PASS. Kiểm tra tay ở 390px: tạo đơn 2 nông dân, tắt mạng (DevTools offline) rồi tải lại trang, draft vẫn còn.
- [ ] **Step 5: Commit** — `feat: luồng lên đơn nhanh cho CTV và đại lý`

---

### Task 10: Khu đối tác: trang chủ, đơn hàng, nông dân, hoa hồng, chia sẻ bảng giá

**Files:**
- Create: `app/doi-tac/page.tsx`, `app/doi-tac/don-hang/page.tsx`, `app/doi-tac/don-hang/[id]/page.tsx`, `app/doi-tac/nong-dan/page.tsx`, `app/doi-tac/hoa-hong/page.tsx`, `lib/orders/edit.ts`, `components/StatusBadge.tsx`, `app/bang-gia/page.tsx`, `app/bang-gia/anh/route.tsx`, `components/PartnerNav.tsx`
- Test: `tests/integration/partner-edit.test.ts`

**Interfaces:**
- Consumes: `replace_order_lines`, `change_order_status` (Task 5); `priceOrder` (Task 3); `STATUS_LABEL`, `canTransition` (Task 2); `getCatalog` (Task 7).
- Produces:
  - `cancelMyOrder(orderId: string): Promise<{ok:true} | {error:'not_editable'}>`. Gọi `change_order_status(..., 'cancelled', userId, 'partner', null)`.
  - `editMyOrder(orderId: string, lines: SeenLine[], acceptChanges: boolean): Promise<SubmitResult>`. Cùng logic phát hiện đổi giá như Task 8 (tách hàm dùng chung `priceAndDiff()` trong `lib/orders/submit.ts`), rồi gọi `replace_order_lines` với `p_actor_kind='partner'`.
  - Trang chủ đối tác: thẻ khuyến mãi đang chạy, "Đổi giá gần đây" (sản phẩm có `updated_price_at` trong 14 ngày), nút lớn "Đơn mới", 5 đơn gần nhất.
  - Đơn hàng: danh sách lọc theo trạng thái. Chi tiết đơn: các dòng nhóm theo nông dân, lịch sử trạng thái, nút "Sửa"/"Hủy" (chỉ khi `new`), nút "Đặt lại" (`/doi-tac/don-moi?tu-don=<id>`).
  - Nông dân: danh sách và tìm kiếm, mỗi khách có tổng đã mua và ngày mua gần nhất.
  - Hoa hồng (chỉ CTV commission; đại lý thấy tổng tiết kiệm theo tháng): theo kỳ `YYYY-MM`, các cột Mã đơn, Số tiền, Trạng thái (Chờ chi/Đã chi), tổng kỳ.
  - `/bang-gia?nhom=<id>`: trang công khai, giá bán lẻ hiện tại, ngày cập nhật, không có hoa hồng/chiết khấu. `/bang-gia/anh?nhom=<id>`: PNG 1080px rộng bằng `ImageResponse`, font Be Vietnam Pro (file `.woff` từ `@fontsource/be-vietnam-pro`, satori không đọc `.woff2`). Nút "Chia sẻ bảng giá" dùng `navigator.share` nếu có, nếu không thì copy link và tải ảnh.

- [ ] **Step 1: Viết test lỗi:** `cancelMyOrder` thành công khi `new`, trả `not_editable` khi `confirmed`; `editMyOrder` trên đơn của CTV khác bị chặn; sửa đơn tính lại tổng và hoa hồng theo giá hiện tại.
- [ ] **Step 2:** `npm run test:int -- partner-edit` → FAIL.
- [ ] **Step 3:** Cài đặt các trang và action.
- [ ] **Step 4:** `npm run test:int -- partner-edit` → PASS. Mở `/bang-gia/anh` kiểm tra chữ tiếng Việt có dấu hiển thị đúng.
- [ ] **Step 5: Commit** — `feat: khu đối tác: đơn hàng, nông dân, hoa hồng, chia sẻ bảng giá`

---

### Task 11: Admin: sản phẩm, nhóm, nhập/xuất Excel

**Files:**
- Create: `lib/excel/products.ts`, `lib/admin/products-actions.ts`, `app/admin/page.tsx` (khung, số liệu tổng quan ở Task 13), `app/admin/san-pham/page.tsx`, `app/admin/san-pham/[id]/page.tsx`, `app/admin/nhom/page.tsx`, `components/admin/AdminNav.tsx`
- Test: `tests/unit/excel-products.test.ts`, `tests/integration/products-actions.test.ts`

**Interfaces:**
- Consumes: `requireStaff('admin')` (Task 6); `adminClient` (Task 4).
- Produces:
  - Mẫu file Excel, hàng 1 là tiêu đề đúng thứ tự: `SKU | Tên | Quy cách | Nhóm | Giá niêm yết | Còn hàng | Hiển thị | Mô tả`.
  - `parseProductSheet(buf: ArrayBuffer, categories: {id:string;name:string}[]): Promise<{ rows: ProductRow[]; errors: { row: number; message: string }[] }>`
    - `ProductRow = { sku; name; unit; categoryId; listPrice: number; inStock: boolean; isActive: boolean; description: string | null }`
    - Giá: chấp nhận số, `"350.000"`, `"350,000"`, `"350000 đ"` → `350000`. Từ chối số âm, số thập phân, rỗng.
    - `Còn hàng`/`Hiển thị`: `có|co|x|1|true` → true; `không|khong|0|false` hoặc rỗng → false. Rỗng ở `Hiển thị` mặc định true.
    - Lỗi theo dòng (số dòng Excel, bắt đầu từ 2): "Thiếu SKU", "Thiếu tên", "Giá không hợp lệ", "Nhóm không tồn tại: <tên>", "SKU trùng trong file (dòng n)". So khớp tên nhóm không phân biệt hoa thường và khoảng trắng hai đầu. Bỏ qua dòng trống hoàn toàn.
  - `importProducts(form: FormData): Promise<{ created: number; updated: number } | { errors: {row:number; message:string}[] }>`. Có lỗi thì không ghi gì. Không lỗi thì upsert theo `sku`. Khi giá đổi, cập nhật `updated_price_at = now()`.
  - `exportProducts(): Promise<Buffer>` (xlsx đúng mẫu, dùng lại được để nhập).
  - CRUD: `saveProduct(form)`, `toggleProduct(id, field: 'in_stock'|'is_active')`, `saveCategory(form)`, `deleteCategory(id)` (chặn nếu còn sản phẩm: `'category_in_use'`). Ảnh tải lên Storage bucket `products` (public), tối đa 2MB, jpg/png/webp.
  - Trang danh sách sản phẩm: bảng có lọc theo nhóm, bật/tắt nhanh "Còn hàng" ngay trên dòng, nút "Nhập Excel", "Xuất Excel", "Tải file mẫu".

- [ ] **Step 1: Viết test lỗi** (`excel-products.test.ts` tạo workbook bằng exceljs ngay trong test)

```ts
test('đọc giá nhiều định dạng', async () => {
  const { rows, errors } = await parse([['NPK1','NPK 16-16-8','bao 50kg','phân npk ','350.000','có','',''],
                                        ['NPK2','NPK 20-20-15','bao 50kg','Phân NPK','350,000','x','1','']])
  expect(errors).toEqual([]); expect(rows.map(r => r.listPrice)).toEqual([350000, 350000])
  expect(rows[0]).toMatchObject({ categoryId: NPK_ID, inStock: true, isActive: true })
})
test('lỗi theo dòng', async () => {
  const { errors } = await parse([['','A','','Phân NPK','1','','',''], ['S1','B','','Không có','1','','',''],
                                  ['S2','C','','Phân NPK','abc','','',''], ['S2','D','','Phân NPK','1','','','']])
  expect(errors).toEqual([{row:2,message:'Thiếu SKU'}, {row:3,message:'Nhóm không tồn tại: Không có'},
                          {row:4,message:'Giá không hợp lệ'}, {row:5,message:'SKU trùng trong file (dòng 4)'}])
})
test('bỏ qua dòng trống', async () => { /* … */ })
// products-actions.test.ts
test('import có lỗi thì không ghi dòng nào', async () => { /* đếm products không đổi */ })
test('import upsert theo SKU và cập nhật updated_price_at khi đổi giá', async () => {})
test('staff thường không gọi được importProducts', async () => {})
test('xuất rồi nhập lại không đổi dữ liệu', async () => {})
```

- [ ] **Step 2:** `npm test -- excel-products && npm run test:int -- products-actions` → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** Chạy lại → PASS.
- [ ] **Step 5: Commit** — `feat: admin quản lý sản phẩm, nhóm, nhập/xuất Excel`

---

### Task 12: Admin: bậc đối tác và tỷ lệ, khuyến mãi, đối tác, nông dân

**Files:**
- Create: `lib/admin/tiers-actions.ts`, `lib/admin/promotions-actions.ts`, `lib/admin/partners-actions.ts`, `lib/admin/farmers-actions.ts`, `app/admin/bac-doi-tac/page.tsx`, `app/admin/khuyen-mai/page.tsx`, `app/admin/doi-tac/page.tsx`, `app/admin/doi-tac/[id]/page.tsx`, `app/admin/nong-dan/page.tsx`, `app/admin/nong-dan/[id]/page.tsx`
- Test: `tests/integration/admin-config.test.ts`

**Interfaces:**
- Consumes: `requireStaff` (Task 6); `transfer_farmer` (Task 5).
- Produces:
  - `saveTier(form)`: tên và loại. Đổi `kind` của bậc đang có đối tác → `'tier_in_use'`.
  - `saveRateGrid(tierId: string, rates: Record<categoryId, number | null>)`: `null` thì xóa dòng. Giá trị hợp lệ `0 ≤ x ≤ 100`, tối đa 2 chữ số thập phân.
  - `saveProductRate(tierId, productId, rate | null)`.
  - `savePromotion(form)`: các trường name, scope, target, type, value, start date, end date (ngày, inclusive). Lưu `starts_at` = 00:00 giờ VN của ngày bắt đầu, `ends_at` = 00:00 giờ VN của **ngày sau** ngày kết thúc. Kiểm tra: percent `0 < v ≤ 100`; fixed_price chỉ với scope product, `v > 0`; end ≥ start.
  - `approvePartner(id, tierId)`, `setPartnerStatus(id, 'active'|'locked')`, `changePartnerTier(id, tierId)`, `resetPartnerPassword(id): Promise<{ tempPassword: string }>` (8 ký tự chữ và số, hiện một lần cho admin).
  - `transferFarmer(farmerId, toPartnerId)`. Chỉ cho chuyển sang CTV commission đang `active`.
  - Giao diện: lưới bậc × nhóm (ô nhập %, lưu cả lưới một lần); danh sách đối tác có tab "Chờ duyệt" kèm số đếm; trang chi tiết nông dân hiện lịch sử mua và lịch sử chuyển chủ.
  - Quyền: các action trên đều yêu cầu `requireStaff('admin')`.

- [ ] **Step 1: Viết test lỗi:** khuyến mãi nhập ngày kết thúc 10/11/2026 → `ends_at = 2026-11-10T17:00:00Z`; percent 120 và fixed_price theo nhóm bị từ chối; `saveRateGrid` từ chối 101 và -1; `approvePartner` chuyển pending → active kèm bậc; `transferFarmer` sang đại lý bị từ chối; staff thường gọi `saveRateGrid` bị chặn.
- [ ] **Step 2:** `npm run test:int -- admin-config` → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** `npm run test:int -- admin-config` → PASS.
- [ ] **Step 5: Commit** — `feat: admin cấu hình bậc, tỷ lệ, khuyến mãi, đối tác, nông dân`

---

### Task 13: Admin: đơn hàng, hoa hồng, tổng quan, cài đặt, xuất dữ liệu

**Files:**
- Create: `lib/admin/orders-actions.ts`, `lib/admin/commission-actions.ts`, `lib/admin/settings-actions.ts`, `lib/excel/export.ts`, `app/admin/page.tsx` (số liệu), `app/admin/don-hang/page.tsx`, `app/admin/don-hang/[id]/page.tsx`, `app/admin/don-hang/[id]/in/page.tsx`, `app/admin/hoa-hong/page.tsx`, `app/admin/cai-dat/page.tsx`, `app/admin/xuat-du-lieu/route.ts`
- Test: `tests/integration/admin-orders.test.ts`, `tests/unit/export.test.ts`

**Interfaces:**
- Consumes: `change_order_status`, `replace_order_lines` (Task 5); `priceAndDiff` (Task 10); `STATUS_LABEL`, `TRANSITIONS` (Task 2); `requireStaff` (Task 6).
- Produces:
  - `setOrderStatus(orderId, to: OrderStatus, note?: string): Promise<{ok:true} | {error:'invalid_transition'}>` (staff).
  - `bulkSetStatus(ids: string[], to): Promise<{ ok: string[]; failed: {id:string; code:string}[] }>`. Gọi lần lượt từng đơn, đơn lỗi không ảnh hưởng đơn khác.
  - `staffEditOrder(orderId, lines, acceptChanges)`. Như `editMyOrder` nhưng `p_actor_kind='staff'`.
  - `markCommissionsPaid(entryIds: string[]): Promise<{ updated: number }>` (admin). Chỉ đổi dòng `pending`, đặt `paid_at = now()`.
  - `commissionReport(period: 'YYYY-MM'): Promise<{ partnerId; partnerName; phone; earned: number; reversed: number; net: number; pending: number; paid: number }[]>`
  - `exportCommissions(period): Promise<Buffer>`, `exportOrders(from: Date, to: Date): Promise<Buffer>` (mỗi dòng đơn một hàng: mã đơn, ngày, nguồn, CTV, nông dân, SĐT, sản phẩm, SL, đơn giá bán, thành tiền, % , hoa hồng, giá đại lý, trạng thái), `exportAll(): Promise<Buffer>` (mỗi bảng chính một sheet). Tiêu đề cột tiếng Việt, cột tiền định dạng `#,##0`.
  - `saveSettings(form)`: store_name, bank_info (ngân hàng, số TK, chủ TK), notify_email, telegram_chat_id, zalo_link (admin).
  - Tổng quan: đơn mới hôm nay (giờ VN), số đơn `delivered` chưa `paid`, doanh số tháng (tổng `subtotal` các đơn `paid` trong tháng, theo thời điểm chuyển `paid`), hoa hồng `pending`.
  - Danh sách đơn: lọc theo trạng thái, nguồn, CTV, khoảng ngày; chọn nhiều để đổi trạng thái hàng loạt; chỉ hiện các trạng thái đích hợp lệ theo `TRANSITIONS`.
  - Trang in `/admin/don-hang/[id]/in`: khổ A5 (`@page { size: A5 }`), gồm tên cửa hàng, mã đơn, ngày, người nhận/điểm giao, bảng hàng nhóm theo nông dân, tổng tiền, chỗ ký người giao và người nhận. Không in hoa hồng.

- [ ] **Step 1: Viết test lỗi:** `bulkSetStatus` với 3 đơn trong đó 1 đơn không hợp lệ → `ok` có 2, `failed` có 1 với code `invalid_transition`; `commissionReport` tính `net = earned + reversed` (một đơn paid rồi returned → net 0); `markCommissionsPaid` không đổi dòng đã `paid`; staff thường gọi `markCommissionsPaid` bị chặn; `exportCommissions` (unit, đọc lại buffer bằng exceljs) có đúng tiêu đề và tổng.
- [ ] **Step 2:** `npm run test:int -- admin-orders && npm test -- export` → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** Chạy lại → PASS.
- [ ] **Step 5: Commit** — `feat: admin xử lý đơn, hoa hồng, tổng quan, cài đặt, xuất Excel`

---

### Task 14: PWA, kiểm thử E2E, tài liệu triển khai và vận hành

**Files:**
- Create: `app/manifest.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `tests/e2e/partner-flow.spec.ts`, `tests/e2e/retail.spec.ts`, `tests/e2e/wholesale.spec.ts`, `README.md`, `docs/huong-dan-van-hanh.md`
- Modify: `playwright.config.ts` (thêm project `mobile` với viewport 390×844, `webServer: npm run dev`)

**Interfaces:**
- Consumes: toàn bộ các task trước; `scripts/create-staff.ts`.

- [ ] **Step 1: Viết các test E2E:**
  - `partner-flow`: đăng ký CTV → admin đăng nhập, duyệt và gán "CTV chuẩn" → CTV lên đơn cho 2 nông dân (một khách thêm mới, một khách tìm lại) → admin chuyển `confirmed → shipping → delivered → paid` → CTV mở "Hoa hồng" thấy đúng số tiền kỳ hiện tại.
  - `wholesale`: đại lý lên đơn, màn hình xác nhận hiện "Bạn trả" đúng theo chiết khấu seed.
  - `retail`: khách thêm 2 sản phẩm vào giỏ, đặt COD, thấy trang thành công có mã `DH…`; admin thấy đơn trong danh sách.
  - Bấm nút "Gửi đơn" hai lần liên tiếp chỉ tạo một đơn.
- [ ] **Step 2:** `npm run test:e2e`. Kỳ vọng: test nào lộ lỗi thì sửa ở code thuộc task tương ứng cho đến khi PASS.
- [ ] **Step 3:** Thêm `manifest.ts` (name lấy từ `NEXT_PUBLIC_SITE_NAME`, `display: 'standalone'`, `start_url: '/doi-tac'`, theme màu xanh lá). Viết `README.md`: chạy local (Docker + `supabase start`), tạo dự án Supabase, `supabase db push`, tạo bucket `products`, biến môi trường, deploy (Vercel; ghi chú gói Hobby chỉ cho mục đích phi thương mại, khi kinh doanh thật dùng Vercel Pro hoặc Cloudflare), tạo tài khoản admin bằng script. Viết `docs/huong-dan-van-hanh.md` cho người không biết code: duyệt CTV, nhập sản phẩm từ Excel, tạo khuyến mãi, xử lý đơn, chốt và chi hoa hồng cuối tháng, xuất dữ liệu cho kế toán.
- [ ] **Step 4:** `npm test && npm run test:int && npm run test:e2e && npm run build`. Kỳ vọng: tất cả PASS, build thành công.
- [ ] **Step 5: Commit** — `feat: PWA, kiểm thử E2E, tài liệu triển khai và vận hành`
