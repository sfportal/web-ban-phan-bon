# Giao diện "wow" + dữ liệu thật — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm lại giao diện cả 4 khu cho đẹp, chuyên nghiệp, kèm bộ ~30 sản phẩm thật có mô tả đầy đủ và ảnh hợp lệ bản quyền.

**Architecture:** Dữ liệu sản phẩm là file JSON trong repo, script sinh SQL seed (local) và SQL cập nhật production. Ảnh không gian lấy URL CDN Unsplash/Pexels; ảnh sản phẩm khi chưa tải lên là SVG minh họa sinh bằng code. Giao diện dùng bộ thành phần `components/ui/` trên Tailwind 4, không đổi logic tiền/đơn/quyền.

**Tech Stack:** Next.js 16 (App Router, cacheComponents), Tailwind CSS 4, lucide-react, Supabase, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-08-giao-dien-wow-du-lieu-that-design.md`

## Global Constraints

- Không đổi logic tiền, đơn hàng, phân quyền, RLS, Server Action nào ngoài phần đọc/ghi các cột mới. Mọi test hiện có phải vẫn đạt (unit, integration, e2e — e2e được sửa selector/dữ liệu khi giao diện đổi).
- Không dùng ảnh bao bì/logo của hãng. Ảnh ngoài chỉ từ Unsplash hoặc Pexels, ghi tác giả + link gốc trong `docs/nguon-anh.md`.
- Giá trong dữ liệu là giá tham khảo thị trường, số nguyên VNĐ dương; admin form và docs ghi rõ "giá tham khảo".
- Mobile-first 390×844: chữ thân ≥16px, nút ≥44px, không tràn ngang. Tiếng Việt, Be Vietnam Pro.
- Màu: primary xanh lá nông nghiệp (`--color-primary` ≈ #166534 / hover #14532d / nhạt #dcfce7), accent vàng lúa (`--color-accent` ≈ #ca8a04 / nhạt #fef9c3), nền kem `--color-surface` #fafaf5, chữ #1c1917. Khai báo trong `app/globals.css` bằng `@theme`.
- Icon: `lucide-react` (cài mới). Không thêm thư viện UI khác.
- Quy trình, môi trường, quy tắc commit: như `implementer-rules.md` của đợt trước (stack local `npm run stack:start`, `npm run db:reset`; `test:int` tự reset DB).

## Review Focus

1. **Ảnh CDN lỗi hoặc chậm** → khung giữ nguyên tỷ lệ, hiện gradient màu nhóm, không vỡ layout. → test ở Task 5 (component `RemoteImage` fallback).
2. **Tên sản phẩm tiếng Việt dài** (≥ 60 ký tự) trên thẻ 390px và trên ảnh minh họa → cắt 2 dòng, không tràn. → test ở Task 3 (`shortLabel`) và kiểm tra e2e mobile Task 9.
3. **Sản phẩm thiếu trường mô tả mới** (do admin tạo kiểu cũ) → trang chi tiết ẩn tab trống, không hiện "undefined"/"null". → test ở Task 6.
4. **Nhập file Excel mẫu cũ 8 cột** → vẫn nhập được, cột mới coi như trống. → test ở Task 2.
5. **Cập nhật dữ liệu production khi đã có đơn tham chiếu sản phẩm mẫu cũ** → sản phẩm đó bị ẩn, không bị xóa (không lỗi FK). → test ở Task 2 (chạy SQL production trên DB local có đơn).

---

### Task 1: Bộ dữ liệu sản phẩm thật + ảnh hợp lệ

**Files:**
- Create: `data/categories.json`, `data/products.json`, `data/sources.md`, `lib/media/images.ts`, `docs/nguon-anh.md`, `lib/dataset/validate.ts`
- Test: `tests/unit/dataset.test.ts`

**Interfaces:**
- Produces:
  - `data/categories.json`: `CategorySeed[]` với `type CategorySeed = { slug: string; name: string; sort_order: number; image_key: ImageKey; rates: { ctv: number; dai_ly: number } }`. Đúng 6 nhóm: `npk` "Phân NPK", `phan-don` "Phân đơn (Urê, DAP, Kali)", `huu-co` "Phân hữu cơ", `phan-bon-la` "Phân bón lá & vi lượng", `thuoc-bvtv` "Thuốc BVTV", `vat-tu` "Vật tư nông nghiệp". `rates` = % cho bậc "CTV chuẩn" và "Đại lý cấp 1".
  - `data/products.json`: `ProductSeed[]` với `type ProductSeed = { sku: string; name: string; brand: string; unit: string; category: string /* slug */; list_price: number; short_desc: string; composition: string; benefits: string; usage: string; crops: string[]; is_featured: boolean }`. 28–32 sản phẩm, mỗi nhóm ≥ 3, `is_featured` đúng 8 sản phẩm. SKU dạng `NPK-DT-20-20-15-50`, chữ hoa, `-`.
  - `lib/media/images.ts`: `export type ImageKey = 'hero' | 'auth' | 'partner' | 'trust' | 'cat-npk' | 'cat-phan-don' | 'cat-huu-co' | 'cat-phan-bon-la' | 'cat-thuoc-bvtv' | 'cat-vat-tu'`; `export const IMAGES: Record<ImageKey, { url: string; alt: string; author: string; sourceUrl: string; license: 'Unsplash' | 'Pexels' }>`. URL là ảnh CDN trực tiếp (`https://images.unsplash.com/photo-...?...&w=1600&q=80` hoặc `https://images.pexels.com/photos/.../...jpeg?auto=compress&w=1600`).
  - `lib/dataset/validate.ts`: `validateDataset(categories: CategorySeed[], products: ProductSeed[]): string[]` (rỗng = hợp lệ) + export các type trên.
- Nghiên cứu: dùng WebSearch/WebFetch (shell không ra mạng). Sản phẩm phải có thật trên thị trường VN (trang hãng/đại lý/sàn TMĐT), thuốc BVTV phải là tên thương mại đang lưu hành, mô tả viết lại bằng lời của mình (không chép nguyên văn), cách dùng ghi liều lượng phổ biến theo cây. Giá lấy từ ≥1 nguồn bán lẻ, làm tròn nghìn. `data/sources.md` ghi nguồn cho từng SKU. Mỗi ảnh trong `IMAGES` phải mở được trang gốc bằng WebFetch và đúng chủ đề (hero: cánh đồng/ruộng lúa VN hoặc châu Á; cat-*: hình hợp nhóm; auth/partner: nông dân/vườn cây).

- [ ] **Step 1: Viết test lỗi** `tests/unit/dataset.test.ts`:

```ts
import categories from '@/data/categories.json'; import products from '@/data/products.json'
test('bộ dữ liệu thật hợp lệ', () => expect(validateDataset(categories, products)).toEqual([]))
test('đủ quy mô', () => {
  expect(categories.map(c => c.slug)).toEqual(['npk','phan-don','huu-co','phan-bon-la','thuoc-bvtv','vat-tu'])
  expect(products.length).toBeGreaterThanOrEqual(28); expect(products.length).toBeLessThanOrEqual(32)
  expect(products.filter(p => p.is_featured)).toHaveLength(8)
  for (const c of categories) expect(products.filter(p => p.category === c.slug).length).toBeGreaterThanOrEqual(3)
})
test('validateDataset bắt lỗi', () => {
  const bad = [{ ...products[0] }, { ...products[0], list_price: 0, category: 'xyz', short_desc: '' }]
  expect(validateDataset(categories, bad)).toEqual(expect.arrayContaining([
    expect.stringContaining('SKU trùng'), expect.stringContaining('Giá không hợp lệ'),
    expect.stringContaining('Nhóm không tồn tại'), expect.stringContaining('Thiếu short_desc')]))
})
test('ảnh chỉ từ Unsplash/Pexels', () => {
  for (const img of Object.values(IMAGES)) expect(img.url).toMatch(/^https:\/\/images\.(unsplash|pexels)\.com\//)
})
```
- [ ] **Step 2:** `npm test -- dataset` → FAIL (thiếu file).
- [ ] **Step 3:** Tra cứu và viết các file. `validateDataset` kiểm: SKU trùng, giá nguyên dương, nhóm tồn tại, các trường text bắt buộc khác rỗng (`name, brand, unit, short_desc, composition, benefits, usage`), `crops` ≥ 1 phần tử, `rates` trong [0,100].
- [ ] **Step 4:** `npm test -- dataset` → PASS.
- [ ] **Step 5: Commit** — `feat: bộ dữ liệu sản phẩm thật và nguồn ảnh hợp lệ`

---

### Task 2: Cột mô tả mới, seed sinh từ dữ liệu, SQL production, Excel, form Admin

**Files:**
- Create: `supabase/migrations/0005_product_details.sql`, `scripts/gen-seed.ts`, `supabase/data-update-production.sql` (sinh ra)
- Modify: `supabase/seed.sql` (sinh ra), `lib/supabase/database.types.ts`, `lib/catalog/queries.ts`, `lib/excel/products.ts`, `lib/admin/products-actions.ts`, `components/admin/ProductForm.tsx`, `components/admin/CategoryManager.tsx` (trường ảnh nhóm), `supabase/setup-production.sql` (sinh lại = 0001..0005 + seed), các test bị ảnh hưởng bởi dữ liệu seed mới (tên/sku/tỷ lệ cứng trong tests/integration và tests/e2e)
- Test: `tests/unit/gen-seed.test.ts`, `tests/unit/excel-products.test.ts` (bổ sung), `tests/integration/catalog.test.ts` (bổ sung), `tests/integration/products-actions.test.ts` (bổ sung), `tests/integration/production-update.test.ts`

**Interfaces:**
- Consumes: Task 1 (`data/*.json`, `IMAGES`, `validateDataset`).
- Produces:
  - Cột `products`: `brand text`, `short_desc text`, `composition text`, `benefits text`, `usage text`, `crops text[] not null default '{}'`, `is_featured boolean not null default false`. Cột `categories`: `slug text unique`, `image_url text`. RLS/grant không đổi (SELECT đã phủ cột mới).
  - `CatalogProduct` thêm `brand: string | null; shortDesc: string | null; composition: string | null; benefits: string | null; usage: string | null; crops: string[]; isFeatured: boolean; categorySlug: string | null`. `getCatalog` trả `categories: { id; name; slug: string | null; imageUrl: string | null }[]`.
  - `scripts/gen-seed.ts` (`npm run data:gen`): chạy `validateDataset` (lỗi → exit 1), ghi `supabase/seed.sql`, `supabase/data-update-production.sql`, và `supabase/setup-production.sql` (= migrations 0001..0005 + seed + bucket products, bọc `begin/commit`). Hàm thuần export để test: `buildSeedSql(categories, products, images): string`, `buildProductionUpdateSql(categories, products, images): string`.
  - Seed: 6 nhóm (slug, image_url từ `IMAGES[image_key].url`), sản phẩm, 2 bậc giữ tên cũ "CTV chuẩn" (commission) và "Đại lý cấp 1" (wholesale), `tier_rates` từ `rates`, settings `store_name`. Giữ 1 ghi đè tỷ lệ theo sản phẩm (sản phẩm phân bón lá đầu tiên, CTV chuẩn = rate nhóm + 2) để test/e2e override vẫn có dữ liệu.
  - SQL production (bọc transaction, chạy lại nhiều lần an toàn): cập nhật nhóm cũ theo `name` cũ ("Phân NPK"→npk, "Phân hữu cơ"→huu-co, "Phân bón lá"→phan-bon-la, "Thuốc BVTV"→thuoc-bvtv, "Vật tư"→vat-tu: đặt slug, tên mới, image_url, sort_order), thêm nhóm còn thiếu theo slug, upsert `tier_rates` cho 2 bậc (on conflict do update), upsert sản phẩm theo `sku`, rồi với sản phẩm có SKU không thuộc bộ mới: xóa nếu không có `order_lines`, ngược lại `is_active=false`.
  - Excel 15 cột: 8 cột cũ + `Thương hiệu | Mô tả ngắn | Thành phần | Công dụng | Cách dùng | Cây trồng | Nổi bật`. `Cây trồng` tách dấu phẩy, trim, bỏ rỗng. `Nổi bật` parse như `Còn hàng`, rỗng → false. File chỉ có 8 cột tiêu đề cũ vẫn hợp lệ. `ProductRow` thêm các trường tương ứng (camelCase như CatalogProduct).
  - ProductForm: thêm các ô trên (Cây trồng nhập dạng chuỗi phẩy), dòng chú thích dưới ô giá: "Giá tham khảo thị trường — sửa theo giá bán thực tế". CategoryManager: thêm ô "Link ảnh nhóm" (http/https).

- [ ] **Step 1: Viết test lỗi:**
  - `gen-seed.test.ts`: `buildSeedSql` chứa đủ mọi SKU đúng 1 lần, chứa `insert into public.categories` với 6 slug, không chứa `undefined`/`NaN`; chuỗi có dấu `'` được escape (`O'Neil` → `O''Neil`); `buildProductionUpdateSql` bắt đầu `begin;` kết thúc `commit;`, chứa `on conflict (sku) do update`, chứa câu ẩn sản phẩm cũ có đơn.
  - `excel-products.test.ts`: file 15 cột parse đúng `crops: ['Lúa','Cà phê']`, `isFeatured: true`; file 8 cột cũ parse được với `brand: null, crops: []`.
  - `catalog.test.ts`: `getCatalog` trả `categorySlug`, `crops` là mảng, `categories[].imageUrl` có giá trị cho 6 nhóm seed.
  - `products-actions.test.ts`: `saveProduct` lưu và đọc lại `brand`, `crops`, `isFeatured`; export rồi import lại (round-trip) giữ nguyên các cột mới.
  - `production-update.test.ts`: trên DB local đã `db:reset` với seed MỚI, chèn thêm 1 sản phẩm SKU `OLD-1` có đơn và 1 sản phẩm `OLD-2` không đơn, chạy file `supabase/data-update-production.sql` hai lần → không lỗi, `OLD-1.is_active=false`, `OLD-2` không còn, số sản phẩm active = độ dài `products.json`.
- [ ] **Step 2:** `npm test && npm run test:int` → các test mới FAIL.
- [ ] **Step 3:** Cài đặt (migration, types viết tay, queries, gen-seed + `npm run data:gen`, Excel, actions, form). Sửa các test/e2e cũ phụ thuộc tên/sku/tỷ lệ seed để đọc từ dữ liệu mới (ưu tiên lấy từ `data/*.json` hoặc DB thay vì hằng số cứng).
- [ ] **Step 4:** `npm test && npm run test:int && npx tsc --noEmit && npm run lint` → PASS.
- [ ] **Step 5: Commit** — `feat: thêm mô tả sản phẩm, seed từ dữ liệu thật, SQL cập nhật production`

---

### Task 3: Ảnh minh họa bao bì `PackageArt`

**Files:**
- Create: `components/PackageArt.tsx`, `lib/media/package-art.ts`
- Modify: `components/ProductImage.tsx` (dùng PackageArt khi không có `imageUrl`)
- Test: `tests/unit/package-art.test.ts`

**Interfaces:**
- Produces:
  - `packageShape(unit: string): 'bag' | 'bottle' | 'pouch' | 'roll' | 'box'` — không phân biệt hoa thường/dấu: chứa `bao` → bag; `chai|lọ|can|ml|lít|\bl\b` → bottle; `gói|túi` → pouch; `cuộn|mét|\bm\b` → roll; `cái|bộ|chiếc|thùng` → box; còn lại → bag.
  - `npkRatio(name: string): string | null` — khớp `\d{1,2}-\d{1,2}-\d{1,2}` đầu tiên.
  - `categoryColors(slug: string | null): { bg: string; fg: string; band: string }` — màu cố định cho 6 slug + mặc định.
  - `shortLabel(name: string, max = 28): string[]` — tối đa 2 dòng, ngắt theo từ, dòng 2 cắt và thêm `…` nếu vượt.
  - `<PackageArt name brand unit categorySlug className? />` — SVG `viewBox="0 0 200 240"`, `role="img"`, `aria-label` = `${name} — ${unit}`; chữ dùng font hệ thống của trang; không logo thật.
  - `ProductImage` props thêm `brand`, `categorySlug` (truyền xuống PackageArt).

- [ ] **Step 1: Viết test lỗi:**

```ts
test.each([['bao 50kg','bag'],['Bao 25 kg','bag'],['chai 1L','bottle'],['chai 500ml','bottle'],['lọ 100ml','bottle'],
  ['gói 100g','pouch'],['túi 1kg','pouch'],['cuộn 100m','roll'],['cái','box'],['bộ','box'],['xyz','bag']])
  ('packageShape(%s)', (u, s) => expect(packageShape(u)).toBe(s))
test('npkRatio', () => { expect(npkRatio('NPK 20-20-15 Đầu Trâu')).toBe('20-20-15'); expect(npkRatio('NPK 16-16-8+TE')).toBe('16-16-8'); expect(npkRatio('Urê Phú Mỹ')).toBeNull() })
test('shortLabel cắt 2 dòng', () => {
  const l = shortLabel('Phân bón hữu cơ vi sinh cao cấp chuyên dùng cho cây ăn trái và cây công nghiệp dài ngày')
  expect(l.length).toBe(2); expect(l.every(x => x.length <= 28)).toBe(true); expect(l[1].endsWith('…')).toBe(true)
})
test('render PackageArt có aria-label', () => {
  const html = renderToStaticMarkup(<PackageArt name="NPK 20-20-15" brand="Đầu Trâu" unit="bao 50kg" categorySlug="npk" />)
  expect(html).toContain('aria-label="NPK 20-20-15 — bao 50kg"'); expect(html).toContain('20-20-15'); expect(html).not.toContain('undefined')
})
```
- [ ] **Step 2:** `npm test -- package-art` → FAIL.
- [ ] **Step 3:** Cài đặt; vẽ 5 hình đơn giản (path/rect bo góc), dải màu nhóm, khối nhãn trắng chứa thương hiệu (chữ nhỏ), tên (2 dòng), N-P-K (chữ lớn nếu có), quy cách ở đáy.
- [ ] **Step 4:** `npm test -- package-art` → PASS; mở `npm run dev` xem trang chủ (ảnh minh họa hiện cho mọi sản phẩm).
- [ ] **Step 5: Commit** — `feat: ảnh minh họa bao bì tự vẽ cho sản phẩm chưa có ảnh`

---

### Task 4: Bộ nhận diện và thành phần giao diện dùng chung

**Files:**
- Modify: `app/globals.css` (token `@theme`, nền, focus ring), `app/layout.tsx` (nếu cần), `next.config.ts` (`images.remotePatterns` cho `images.unsplash.com`, `images.pexels.com`, và `*.supabase.co/storage/v1/object/public/**`), `package.json` (+ `lucide-react`)
- Create: `components/ui/Button.tsx`, `Card.tsx`, `Badge.tsx`, `Field.tsx` (Input/Select/Textarea có label + lỗi), `SectionHeader.tsx`, `EmptyState.tsx`, `StatCard.tsx`, `RemoteImage.tsx`, `components/ui/index.ts`
- Test: `tests/unit/ui.test.tsx`

**Interfaces:**
- Produces (export từ `@/components/ui`):
  - `Button({ variant?: 'primary'|'secondary'|'ghost'|'danger'; size?: 'md'|'lg'; asChild?: never; href?: string; ...button props })` — có `href` thì render `next/link`; `md` cao 44px, `lg` 52px.
  - `Card({ className?, children, as? })`, `Badge({ tone?: 'green'|'yellow'|'red'|'gray'|'blue', children })`, `Field({ label, error?, hint?, children })`, `SectionHeader({ title, subtitle?, action? })`, `EmptyState({ icon?, title, description?, action? })`, `StatCard({ label, value, hint?, icon? })`.
  - `RemoteImage({ src, alt, fallbackTone?: string /* class bg gradient */, className, sizes, priority? })` — client component dùng `next/image` `fill`; `onError` → ẩn ảnh, hiện div gradient; luôn bọc trong khung có tỷ lệ do className quyết định.
- [ ] **Step 1: Viết test lỗi** (`renderToStaticMarkup` / React Testing Library với jsdom đã có): Button có `href` render thẻ `a`; Button `size="lg"` có class chiều cao ≥ `h-[52px]` hoặc `h-13`; `RemoteImage` khi kích hoạt `onError` (RTL `fireEvent.error`) không còn `img` và có phần tử fallback `data-testid="image-fallback"`; `Field` gắn `aria-invalid` và hiện lỗi.
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt + `npm i lucide-react`. **Step 4:** `npm test && npm run build` → PASS.
- [ ] **Step 5: Commit** — `feat: bộ nhận diện và thành phần giao diện dùng chung`

---

### Task 5: Cửa hàng công khai

**Files:**
- Create: `components/shop/SiteHeader.tsx`, `SiteFooter.tsx`, `Hero.tsx`, `CategoryTiles.tsx`, `TrustStrip.tsx`, `ProductGrid.tsx`, `ProductTabs.tsx`
- Modify: `app/(shop)/page.tsx`, `app/(shop)/san-pham/[id]/page.tsx`, `app/(shop)/gio-hang/page.tsx`, `components/ProductCard.tsx`, `components/Storefront.tsx`, `components/CartView.tsx`, `components/CartFab.tsx`, `app/(shop)/gio-hang/RetailForm.tsx` (chỉ trình bày), `app/(shop)/dat-hang-thanh-cong/[code]/page.tsx`, `app/bang-gia/page.tsx` (chỉ trình bày)
- Test: `tests/unit/product-tabs.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`CatalogProduct` mới, `categories[].slug/imageUrl`), Task 3 (`ProductImage`), Task 4 (`@/components/ui`, `RemoteImage`), `IMAGES` (Task 1).
- Produces: `ProductTabs({ product: Pick<CatalogProduct,'benefits'|'composition'|'usage'|'crops'|'description'> })` — tab theo thứ tự Công dụng, Thành phần, Cách dùng, Cây phù hợp, Mô tả; chỉ hiện tab có nội dung; không còn tab nào → không render gì.
- Bố cục: header dính (tên cửa hàng, ô tìm, giỏ có số lượng, link "Đăng nhập CTV"); trang chủ: Hero (`IMAGES.hero`, khẩu hiệu "Vật tư nông nghiệp chính hãng — giao tận vườn", nút "Mua ngay" cuộn tới lưới, "Trở thành CTV" → `/dang-ky`), CategoryTiles (ảnh nhóm, bấm lọc `?nhom=<slug>`), "Sản phẩm nổi bật" (isFeatured), TrustStrip (Hàng chính hãng · Giao tận vườn · Tư vấn kỹ thuật miễn phí · Hoa hồng hấp dẫn cho CTV), lưới sản phẩm có lọc + tìm, Footer (tên, Zalo nếu có, link bảng giá, CTV). Thẻ sản phẩm: ảnh 1:1, thương hiệu (chữ nhỏ), tên 2 dòng, quy cách, giá (+ giá gạch & Badge "-x%" khi KM), nút thêm giỏ. Chi tiết: ảnh lớn, thương hiệu, tên, mô tả ngắn, giá, nút thêm giỏ dính đáy trên mobile, ProductTabs, "Cùng nhóm" (≤4). Giỏ: thanh tổng tiền + nút dính đáy.
- [ ] **Step 1: Viết test lỗi** `product-tabs.test.tsx`: đủ trường → 5 tab đúng thứ tự; chỉ có `usage` → đúng 1 tab "Cách dùng"; tất cả rỗng/null/`[]` → `container.innerHTML === ''`; không chứa chuỗi `undefined`/`null`.
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt các component/trang.
- [ ] **Step 4:** `npm test && npm run test:int && npm run build && npm run lint` → PASS; chạy `npm run test:e2e` → sửa selector e2e nếu nhãn đổi (giữ nguyên ý nghĩa test). Chụp màn hình trang chủ/chi tiết/giỏ ở 390px và 1440px bằng Playwright, xem lại bằng Read, sửa chỗ vỡ/tràn.
- [ ] **Step 5: Commit** — `feat: giao diện cửa hàng mới`

---

### Task 6: Đăng ký/đăng nhập và khu đối tác

**Files:**
- Create: `components/auth/AuthShell.tsx`
- Modify: `app/dang-nhap/page.tsx`, `app/dang-ky/page.tsx`, `app/cho-duyet/page.tsx`, các form client của auth, `app/doi-tac/layout.tsx`, `components/PartnerNav.tsx`, `app/doi-tac/page.tsx`, `app/doi-tac/don-moi/*` (FarmerPicker, ProductPicker, ConfirmStep, OrderFlow — chỉ trình bày), `app/doi-tac/don-hang/**`, `app/doi-tac/nong-dan/page.tsx`, `app/doi-tac/hoa-hong/page.tsx`
- Test: e2e hiện có (partner-flow, wholesale) phải đạt; `tests/unit/auth-shell.test.tsx`

**Interfaces:**
- Consumes: Task 3, Task 4, `IMAGES.auth`, `IMAGES.partner`.
- Produces: `AuthShell({ title, subtitle?, children })` — desktop chia đôi (trái ảnh `IMAGES.auth` + 3 lợi ích CTV: "Hoa hồng theo từng đơn", "Lên đơn trên điện thoại trong 1 phút", "Theo dõi đơn và hoa hồng minh bạch"; phải form), mobile dải ảnh cao 160px phía trên.
- Khu đối tác: header gradient xanh có lời chào tên đối tác; StatCard: CTV = "Hoa hồng tháng này", "Đơn đang xử lý", "Nông dân"; đại lý = "Tiết kiệm tháng này", "Đơn đang xử lý", "Đơn tháng này"; nút lớn "Lên đơn mới"; KM thẻ cuộn ngang; thanh điều hướng đáy trên mobile với icon (Trang chủ, Lên đơn, Đơn hàng, Nông dân/Hoa hồng). Luồng lên đơn: thanh 3 bước (Nông dân → Sản phẩm → Xác nhận; đại lý 2 bước), thẻ sản phẩm có `ProductImage` nhỏ. Danh sách đơn/nông dân/hoa hồng dạng Card. Số liệu StatCard lấy từ truy vấn hiện có (không thêm Server Action mới; nếu cần truy vấn mới thì đặt trong page server component, gọi `requirePartner()` như cũ).
- [ ] **Step 1: Viết test lỗi** `auth-shell.test.tsx`: render có `title`, có đủ 3 lợi ích, có `img`/RemoteImage với alt từ `IMAGES.auth.alt`.
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt.
- [ ] **Step 4:** `npm test && npm run test:int && npm run test:e2e && npm run build && npm run lint` → PASS. Chụp màn hình đăng nhập, đăng ký, trang chủ đối tác, 3 bước lên đơn ở 390px; sửa chỗ vỡ.
- [ ] **Step 5: Commit** — `feat: giao diện đăng nhập/đăng ký và khu đối tác mới`

---

### Task 7: Trang quản trị

**Files:**
- Modify: `app/admin/layout.tsx`, `components/admin/AdminNav.tsx` (sidebar icon, thu gọn mobile thành menu), `app/admin/page.tsx` (StatCard), các trang danh sách admin (san-pham, nhom, bac-doi-tac, khuyen-mai, doi-tac, nong-dan, don-hang, hoa-hong, cai-dat — chỉ trình bày: bảng zebra, header trang, nút dùng `Button`), `components/admin/ProductForm.tsx` (bố cục 2 cột + xem trước `PackageArt`/ảnh)
- Test: integration/e2e hiện có đạt; `tests/unit/admin-nav.test.tsx`

**Interfaces:**
- Consumes: Task 3, Task 4. Không đổi Server Action.
- AdminNav: mục có icon lucide (LayoutDashboard, Package, Tags, Layers, Percent, Users, Sprout, ClipboardList, Wallet, Settings); "Cài đặt" chỉ admin (giữ hành vi cũ); mục đang mở được tô sáng theo `usePathname`.
- [ ] **Step 1: Viết test lỗi** `admin-nav.test.tsx`: với role `staff` không có "Cài đặt"; với `admin` có; mục khớp pathname có `aria-current="page"`.
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt.
- [ ] **Step 4:** `npm test && npm run test:int && npm run test:e2e && npm run build && npm run lint` → PASS. Chụp màn hình tổng quan, danh sách sản phẩm, form sản phẩm, đơn hàng ở 1440px và 390px.
- [ ] **Step 5: Commit** — `feat: giao diện quản trị mới`

---

### Task 8: Kiểm tra tổng thể và tài liệu

**Files:**
- Modify: `README.md` (mục cập nhật dữ liệu: `npm run data:gen`, chạy `0005` + `data-update-production.sql` trên production), `docs/huong-dan-van-hanh.md` (trường mô tả mới, ảnh, Excel 15 cột, ghi chú giá tham khảo), `tests/e2e/*` (thêm: trang chi tiết sản phẩm hiện tab "Cách dùng"; trang chủ hiện "Sản phẩm nổi bật" ≥ 1 thẻ; không có tràn ngang ở 390px: `document.documentElement.scrollWidth <= 390`)
- [ ] **Step 1:** Viết 3 kiểm tra e2e mới → chạy, FAIL nếu thiếu.
- [ ] **Step 2:** Sửa cho đạt. **Step 3:** `npm test && npm run test:int && npm run test:e2e && npm run build && npm run lint` → PASS.
- [ ] **Step 4:** Chụp bộ màn hình cuối (trang chủ, chi tiết, giỏ, đăng nhập, trang chủ đối tác, admin tổng quan; 390px + 1440px) lưu `/tmp/screens/*.png`, liệt kê đường dẫn trong report.
- [ ] **Step 5: Commit** — `docs: cập nhật hướng dẫn dữ liệu và giao diện mới`
