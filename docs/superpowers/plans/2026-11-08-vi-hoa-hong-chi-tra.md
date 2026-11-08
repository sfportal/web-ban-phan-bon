# Ví hoa hồng, chi trả có chứng từ + dữ liệu đặt thử — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CTV có ví hoa hồng; admin chi trả theo yêu cầu rút hoặc theo đợt (tuần/tháng/tùy chọn) kèm chứng từ; ví tự cập nhật; admin tạo/xóa dữ liệu đặt thử trên web thật.

**Architecture:** Hai bảng mới `payout_batches`, `payouts` + hàm Postgres khóa ví theo dòng `partners` cho mọi thao tác tiền; số dư tính từ `commission_entries` và `payouts`. Server Actions (service role) gọi RPC; RLS cho đối tác đọc payouts của mình. Chứng từ ở bucket riêng tư `payout-proofs`, xem bằng signed URL. Dữ liệu thử đánh dấu `is_demo`, tạo bằng chính các RPC đơn hàng hiện có.

**Tech Stack:** Next.js 16, Supabase (Postgres, Auth, Storage), Vitest, Playwright, exceljs.

**Spec:** `docs/superpowers/specs/2026-11-08-vi-hoa-hong-chi-tra-design.md`

## Global Constraints

- Không đổi logic tạo đơn, tính giá, trạng thái đơn, ghi nhận `commission_entries`.
- Mọi page/Server Action trong /doi-tac, /admin tự gọi `requirePartner()` / `requireStaff(...)`; thao tác chi trả, dữ liệu thử, cài đặt yêu cầu `requireStaff('admin')`; nhân viên chỉ xem.
- Hàm RPC chỉ cấp `execute` cho `service_role`. Tiền là bigint VNĐ nguyên dương; giờ theo Asia/Ho_Chi_Minh.
- `min_payout` mặc định 100000 (setting key `min_payout`, jsonb số).
- Chứng từ: jpg/png/webp/pdf, ≤ 5MB, bucket `payout-proofs` private, path `<partner_id>/<payout_id>.<ext>`, signed URL 300s.
- SĐT đối tác thử: 0900000101–0900000105; mật khẩu do admin nhập (≥ 8 ký tự), không lưu ở đâu khác.
- UI dùng `components/ui/*`, tiếng Việt, mobile-first 390px, không tràn ngang; tiền hiển thị qua `formatVnd`.
- Môi trường/quy trình/commit: như `implementer-rules.md` của đợt trước (stack local không Docker, không có Storage local → test không phụ thuộc upload thật).

## Review Focus

1. **Hai yêu cầu rút gửi gần như cùng lúc** → tổng không vượt số dư (khóa dòng partners). → test Task 1.
2. **Trả hàng sau khi đã chi khiến số dư âm** → không cho rút, ví hiển thị rõ, đợt chi bỏ qua CTV đó. → test Task 1 + Task 3.
3. **Bấm "Đánh dấu đã chuyển" hai lần / cho khoản đã từ chối** → không đổi dữ liệu lần hai, khoản đã từ chối báo lỗi. → test Task 1.
4. **Đối tác mở chứng từ của người khác (đoán payout id)** → bị từ chối. → test Task 2.
5. **"Xóa dữ liệu thử" khi đã có dữ liệu thật đan xen** (đơn lẻ thật của nông dân thử? đơn thật trỏ tới SP chung) → chỉ xóa bản ghi is_demo, dữ liệu thật nguyên vẹn. → test Task 5.

---

### Task 1: Lược đồ + hàm ví/chi trả

**Files:** Create `supabase/migrations/0006_payouts.sql`; Modify `lib/supabase/database.types.ts`, `scripts/gen-seed.ts` (setup-production gồm 0006 + bucket `payout-proofs` private; seed thêm settings `min_payout`), sinh lại `supabase/setup-production.sql`, `supabase/seed.sql`; Test `tests/integration/payouts.test.ts`.

**Interfaces — Produces:**
- Cột: `partners.bank_name text, bank_account text, bank_holder text, is_demo boolean not null default false`; `farmers.is_demo`, `orders.is_demo` (boolean not null default false).
- `payout_batches(id uuid pk, kind text check in ('weekly','monthly','custom'), cutoff_date date not null, note text, is_demo bool not null default false, created_by uuid, created_at timestamptz default now())`.
- `payouts(id uuid pk, partner_id uuid not null references partners on delete cascade, amount bigint not null check (amount > 0), source text check in ('request','batch'), batch_id uuid references payout_batches on delete cascade, status text check in ('requested','approved','paid','rejected'), bank_name text, bank_account text, bank_holder text, transfer_ref text, transferred_on date, proof_path text, reject_reason text, requested_at timestamptz default now(), decided_by uuid, decided_at timestamptz, paid_by uuid, paid_at timestamptz, is_demo bool not null default false)`; index `(partner_id, status)`.
- RLS: payouts SELECT cho đối tác khi `partner_id = current_partner_id()`, staff đọc tất cả; payout_batches chỉ staff. Không policy ghi.
- RPC (service_role):
  - `partner_wallet(p_partner_id uuid) returns table(earned bigint, pending_out bigint, paid bigint, available bigint)`.
  - `request_payout(p_partner_id uuid, p_amount bigint, p_min bigint) returns uuid` — khóa `partners` dòng đó; lỗi: `not_commission`, `missing_bank`, `below_min`, `insufficient_balance`. Snapshot ngân hàng.
  - `decide_payout(p_payout_id uuid, p_action text, p_actor uuid, p_reason text) returns void` — `approve`: requested→approved; `reject`: requested|approved→rejected (reason bắt buộc: `reason_required`); khác → `invalid_state`.
  - `mark_payout_paid(p_payout_id uuid, p_actor uuid, p_ref text, p_date date, p_proof_path text) returns void` — requested|approved → paid; đã paid → không làm gì; rejected → `invalid_state`; ref rỗng → `ref_required`; date > hôm nay (VN) → `invalid_date`.
  - `create_payout_batch(p_kind text, p_cutoff date, p_min bigint, p_actor uuid, p_note text, p_is_demo boolean default false) returns jsonb` → `{batch_id, created: int, skipped_no_bank: int, skipped_below_min: int}`; khóa từng partner theo thứ tự id.
- Settings `min_payout` = 100000 trong seed.

- [ ] **Step 1: Viết test lỗi** (`payouts.test.ts`, dùng helpers cũ + tạo commission entries qua đơn paid hoặc insert trực tiếp bằng adminClient):
  - ví = earned − pending − paid sau chuỗi: earn 120000, request 50000, paid 30000 (một khoản khác) → `{earned:120000,pending_out:50000,paid:30000,available:40000}`.
  - `request_payout` lỗi `missing_bank` khi thiếu ngân hàng; `below_min` với 99999 khi min 100000; `insufficient_balance` khi vượt; đại lý → `not_commission`.
  - Song song: available 150000, `Promise.all` hai yêu cầu 100000 → đúng 1 thành công, 1 `insufficient_balance`.
  - Reject hoàn tiền: available trở lại; reject thiếu lý do → `reason_required`.
  - mark paid hai lần → lần hai không đổi `paid_at`; mark paid khoản rejected → `invalid_state`; ngày tương lai → `invalid_date`.
  - Số dư âm (reversal sau khi paid) → request bị `insufficient_balance`; batch bỏ qua (skipped_below_min).
  - Batch: 3 CTV (1 thiếu ngân hàng, 1 dưới mức, 1 đủ) → `{created:1, skipped_no_bank:1, skipped_below_min:1}`; hoa hồng sau cutoff không tính.
  - RLS: CTV A không đọc payouts của B; partner không đọc payout_batches; anon/authenticated không execute RPC.
- [ ] **Step 2:** `npm run stack:start && npm run test:int -- payouts` → FAIL.
- [ ] **Step 3:** Viết migration + types + gen-seed; `npm run data:gen`.
- [ ] **Step 4:** `npm run test:int && npm test && npx next typegen && npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `feat: lược đồ và hàm ví hoa hồng, chi trả`

---

### Task 2: Server Actions + lưu chứng từ + thông báo

**Files:** Create `lib/payouts/wallet.ts` (server-only đọc ví/lịch sử), `lib/payouts/partner-actions.ts` ('use server'), `lib/payouts/admin-actions.ts` ('use server'), `lib/payouts/proof-storage.ts` (server-only), `lib/payouts/validate.ts` (thuần); Modify `lib/notify/index.ts` (+ `notifyPayoutRequest`), `lib/excel/export.ts` (+ 3 sheet builder), `lib/admin/settings-actions.ts` (+ `min_payout`), `app/admin/xuat-du-lieu/route.ts` (+ `loai=chi-tra-yeu-cau|chi-tra-dot|so-du`); Test `tests/unit/payout-validate.test.ts`, `tests/integration/payout-actions.test.ts`.

**Interfaces — Consumes:** RPC Task 1, `requirePartner/requireStaff`, `adminClient`, `asUser`.
**Produces:**
- `getWallet(partnerId: string): Promise<{ earned: number; pendingOut: number; paid: number; available: number }>`; `getWalletHistory(partnerId): Promise<{ entries: {orderCode: string; amount: number; kind: 'earn'|'reversal'; createdAt: Date}[]; payouts: PayoutRow[] }>`; `type PayoutRow = { id; amount; source; status; transferRef: string|null; transferredOn: string|null; hasProof: boolean; rejectReason: string|null; requestedAt: Date; paidAt: Date|null }`.
- Partner: `saveBankInfo(form): Promise<{ok:true}|{error:'missing_fields'|'invalid_account'}>` (account chỉ chữ số/khoảng trắng, 6–20 số); `requestPayout(form: {amount}): Promise<{ok:true; id}|{error:'not_commission'|'missing_bank'|'below_min'|'insufficient_balance'|'invalid_amount'}>` (gửi `notifyPayoutRequest` qua `after()`); `getProofUrl(payoutId): Promise<{url: string}|{error:'not_found'|'no_proof'}>` (chỉ payout của mình).
- Admin (`requireStaff('admin')`): `approvePayout(id)`, `rejectPayout(id, reason)`, `markPayoutPaid(form: {id, ref, date, proof?: File})` (validate file → upload `payout-proofs/<partner>/<id>.<ext>` → RPC; upload lỗi → `{error:'upload_failed'}` không đổi trạng thái), `markBatchPaid(batchId, {ref, date})` (từng khoản chưa paid, trả `{ok:number; failed:{id;code}[]}`), `createBatch(form: {kind, cutoff, note?})` → kết quả RPC, `getAdminProofUrl(id)`.
- `validateProof(file: {type: string; size: number}): 'ok'|'bad_type'|'too_large'`, `parseAmount(input: string): number|null` (chấp nhận "1.500.000", "1500000", "1,500,000").
- Excel: `buildPayoutRequestsSheet`, `buildPayoutBatchSheet`, `buildBalancesSheet` (tiêu đề tiếng Việt, cột tiền `#,##0`).
- [ ] **Step 1: Viết test lỗi:** unit `validateProof`, `parseAmount`; integration: `requestPayout` qua `asUser(ctv)` tạo khoản và gọi notify (mock fetch); `getProofUrl` của CTV khác → `not_found`; `markPayoutPaid` với staff thường bị chặn; `markPayoutPaid` không file → paid, proof_path null; `createBatch` trả đúng số; `saveBankInfo` lỗi định dạng; route xuất `chi-tra-*` staff được đọc `so-du`? → quyết: cả 3 xuất cho admin, staff bị chặn.
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt. **Step 4:** `npm test && npm run test:int && npx tsc --noEmit && npm run lint` → PASS.
- [ ] **Step 5: Commit** — `feat: server actions ví, chi trả, chứng từ`

---

### Task 3: Giao diện đối tác "Ví hoa hồng"

**Files:** Modify `app/doi-tac/hoa-hong/page.tsx` (→ Ví hoa hồng cho CTV; đại lý giữ trang Tiết kiệm như cũ), `components/PartnerNav.tsx` (nhãn "Ví"), `app/doi-tac/page.tsx` (StatCard "Số dư khả dụng" thay/ bên cạnh "Hoa hồng tháng này"); Create `app/doi-tac/hoa-hong/WithdrawForm.tsx`, `BankInfoForm.tsx`, `PayoutList.tsx`; Test `tests/e2e/wallet.spec.ts`.

**Interfaces — Consumes:** Task 2 actions/queries.
- Trang: 4 StatCard (Đã kiếm được, Đang chờ chi, Đã nhận, Số dư khả dụng); số dư âm → cảnh báo; nút "Rút tiền" mở form (số tiền, nút "Rút hết", gợi ý mức tối thiểu); thiếu ngân hàng → form ngân hàng trước; lịch sử hoa hồng theo đơn (mã đơn, +/−, ngày); danh sách khoản chi (Badge trạng thái: Chờ duyệt / Đã duyệt / Đã chuyển / Từ chối + lý do; mã GD; ngày; "Xem chứng từ" mở signed URL tab mới).
- [ ] **Step 1: Viết e2e lỗi** `wallet.spec.ts`: CTV có hoa hồng (tạo qua luồng admin chuyển paid như partner-flow) → khai ngân hàng → rút 100.000 → thấy "Chờ duyệt", số dư giảm 100.000; rút vượt số dư → thông báo "Số dư không đủ".
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt. **Step 4:** full chain (`npm test && npm run test:int && npm run test:e2e && npm run build && npm run lint`) PASS; chụp 390px trang ví.
- [ ] **Step 5: Commit** — `feat: trang ví hoa hồng cho CTV`

---

### Task 4: Giao diện admin "Chi trả"

**Files:** Modify `app/admin/hoa-hong/page.tsx` (→ Chi trả, 3 tab qua `?tab=yeu-cau|dot-chi|so-du`), `components/admin/AdminNav.tsx` (nhãn "Chi trả"), `app/admin/page.tsx` (thẻ "Hoa hồng chờ chi" dùng ví), `components/admin/SettingsForm.tsx` + `app/admin/cai-dat/page.tsx` (ô "Mức rút tối thiểu"); Create `components/admin/payouts/RequestList.tsx`, `BatchList.tsx`, `BatchCreate.tsx`, `MarkPaidDialog.tsx`, `BalanceTable.tsx`; Delete/replace `components/admin/CommissionPayout.tsx` (và test liên quan đến "đánh dấu đã chi" cũ — cập nhật theo luồng mới); Test `tests/e2e/admin-payouts.spec.ts`.

- Tab Yêu cầu rút: lọc trạng thái; mỗi dòng: CTV, SĐT, số tiền, ngân hàng (snapshot), ngày yêu cầu, Duyệt / Từ chối (nhập lý do) / Đánh dấu đã chuyển (MarkPaidDialog: mã GD, ngày, file). Tab Đợt chi: tạo đợt (kind, ngày chốt, ghi chú) → hiện kết quả (tạo n, bỏ qua thiếu NH m, dưới mức k); danh sách đợt; chi tiết đợt: các khoản, đánh dấu từng khoản hoặc "Đánh dấu tất cả đã chuyển" (mã GD chung + ngày). Tab Số dư: bảng mọi CTV (earned, pending, paid, available). Nút xuất Excel mỗi tab (admin). Staff: xem, không có nút hành động.
- [ ] **Step 1: Viết e2e lỗi** `admin-payouts.spec.ts`: CTV có yêu cầu rút → admin duyệt → đánh dấu đã chuyển (mã "GD123", ngày hôm nay) → CTV mở ví thấy "Đã chuyển", "Đã nhận" tăng; admin tạo đợt chi theo tháng → thấy kết quả đếm.
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt. **Step 4:** full chain PASS; chụp 1440/390.
- [ ] **Step 5: Commit** — `feat: trang chi trả cho admin`

---

### Task 5: Dữ liệu đặt thử

**Files:** Create `lib/admin/demo-data.ts` ('use server' actions + server-only builder), `app/admin/du-lieu-thu/page.tsx`; Modify `components/admin/AdminNav.tsx` (mục "Dữ liệu thử", admin-only), danh sách admin đơn/đối tác/nông dân/chi trả (Badge "Thử" khi `is_demo`); Test `tests/integration/demo-data.test.ts`.

**Produces:** `createDemoData(form: {password}): Promise<{ok:true; summary: {partners:number; farmers:number; orders:number; payouts:number}}|{error:'weak_password'|'already_exists'|'phone_taken'}>`; `deleteDemoData(): Promise<{ok:true; deleted: Record<string, number>}>`; `getDemoStatus(): Promise<{exists: boolean}>`.
- Tạo theo spec §5: auth users qua `auth.admin.createUser` (email `phoneToEmail`), partners is_demo (+ ngân hàng giả "Ngân hàng Thử", số TK "000000000101"…), farmers is_demo qua `claim_farmer`, đơn qua `create_order` (p_order có `is_demo: true` — mở rộng `create_order` trong migration mới `0007_demo_flag.sql` để nhận khóa này) rồi `change_order_status` tới trạng thái đích; 3 đơn lẻ; `request_payout` 1 khoản; 1 khoản paid (`DEMO-0001`, không file); `create_payout_batch(..., p_is_demo := true)`.
- Xóa: payouts → payout_batches → order_status_log/order_lines/commission_entries của đơn is_demo → orders → farmers → partners → auth users (email của partners thử) — chỉ `is_demo = true`.
- [ ] **Step 1: Viết test lỗi:** tạo → đủ số lượng, có đủ 7 trạng thái đơn, ví CTV thử khớp `partner_wallet`; tạo lần hai → `already_exists`; xóa → mọi bảng không còn is_demo, tạo trước một đơn thật + đối tác thật → vẫn còn nguyên sau khi xóa; staff thường bị chặn.
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt (+ migration 0007, types, gen-seed). **Step 4:** full chain PASS.
- [ ] **Step 5: Commit** — `feat: tạo và xóa dữ liệu đặt thử`

---

### Task 6: Tài liệu + kiểm tra tổng thể

**Files:** Modify `README.md` (migration 0006/0007, bucket `payout-proofs`), `docs/huong-dan-van-hanh.md` (quy trình chi trả: duyệt yêu cầu, tạo đợt chi, chứng từ, mức tối thiểu, dữ liệu thử), `tests/e2e/*` nếu cần.
- [ ] **Step 1:** Chạy full chain 3 lần liên tiếp đều xanh (`npm test && npm run test:int && npm run test:e2e && npm run build && npm run lint`), ghi log.
- [ ] **Step 2:** Chụp màn hình cuối: ví CTV 390, chi trả admin 1440, dữ liệu thử admin → `/tmp/screens/payout-*.png`.
- [ ] **Step 3: Commit** — `docs: hướng dẫn chi trả hoa hồng và dữ liệu thử`
