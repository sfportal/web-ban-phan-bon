begin;
-- Sinh tự động bởi scripts/gen-seed.ts từ data/*.json (npm run data:gen) — không sửa tay.
-- Cập nhật bản thật (đã chạy 0001–0005) lên ví hoa hồng, chi trả có chứng từ, dữ liệu thử.
-- Dán TOÀN BỘ file vào SQL Editor của Supabase, bấm Run — một giao dịch: lỗi ở đâu thì không đổi gì.
-- Thứ tự: chạy file này → kiểm tra (README) → rồi mới push main lên Vercel.
-- Trước khi chạy, xem hoa hồng đã chi theo cách cũ (sẽ thành khoản chi "Đã chi trước khi có ví"):
--   select count(*), coalesce(sum(amount), 0) from public.commission_entries where status = 'paid';
-- Từ lúc chạy tới khi bản mới lên Vercel, đừng bấm nút "Đã chi" cũ ở trang Hoa hồng.

-- 0. Chỉ chạy một lần: đã có bảng payouts thì dừng.
do $guard$
begin
  if to_regclass('public.payouts') is not null then
    raise exception 'Dừng: đã chạy rồi (đã có bảng public.payouts). Không cần chạy lại file này.';
  end if;
end
$guard$;

-- ===== supabase/migrations/0006_payouts.sql =====
-- Ví hoa hồng và chi trả. Số dư tính từ commission_entries (earn +, reversal −) và payouts:
--   earned = Σ commission_entries.amount; pending_out = Σ payouts requested|approved;
--   paid = Σ payouts paid; available = earned − pending_out − paid (có thể âm).
-- Mọi thao tác đổi tiền khóa dòng partners (select … for update) trước khi tính ví để chống
-- bấm đúp / rút vượt số dư. commission_entries.status/paid_at không còn dùng cho chi trả.
-- Lỗi nghiệp vụ dùng mã ngắn làm message (như 0003). Hàm: security invoker, chỉ service_role.
-- Cờ is_demo đánh dấu dữ liệu đặt thử (xóa được mà không đụng dữ liệu thật).

-- Cột mới ------------------------------------------------------------------------

alter table public.partners
  add column if not exists bank_name text,
  add column if not exists bank_account text,
  add column if not exists bank_holder text,
  add column if not exists is_demo boolean not null default false;

alter table public.farmers add column if not exists is_demo boolean not null default false;
alter table public.orders add column if not exists is_demo boolean not null default false;

-- Bảng ---------------------------------------------------------------------------

create table public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('weekly', 'monthly', 'custom')),
  cutoff_date date not null,
  note text,
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  amount bigint not null check (amount > 0),
  source text not null check (source in ('request', 'batch')),
  batch_id uuid references public.payout_batches(id) on delete cascade,
  status text not null check (status in ('requested', 'approved', 'paid', 'rejected')),
  -- Snapshot ngân hàng lúc tạo khoản chi.
  bank_name text,
  bank_account text,
  bank_holder text,
  transfer_ref text,
  transferred_on date,
  proof_path text, -- payout-proofs/<partner_id>/<payout_id>.<ext>
  reject_reason text,
  requested_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  paid_by uuid,
  paid_at timestamptz,
  is_demo boolean not null default false,
  check (source <> 'batch' or batch_id is not null)
);
create index payouts_partner_status_idx on public.payouts(partner_id, status);
create index payouts_batch_idx on public.payouts(batch_id);
create index payouts_status_idx on public.payouts(status, requested_at desc);

-- RLS: đối tác đọc khoản chi của mình, nhân viên đọc tất cả; đợt chi chỉ nhân viên.
-- Không có policy ghi (ghi qua service_role / RPC).
alter table public.payout_batches enable row level security;
alter table public.payouts enable row level security;

create policy payouts_read on public.payouts for select
  to authenticated using (partner_id = (select public.current_partner_id()) or (select public.is_staff()));

create policy payout_batches_read on public.payout_batches for select
  to authenticated using ((select public.is_staff()));

-- Quyền bảng tường minh (khớp quyền mặc định ở 0002).
revoke all on public.payouts, public.payout_batches from anon, authenticated;
grant select on public.payouts, public.payout_batches to anon, authenticated;
grant all on public.payouts, public.payout_batches to service_role;

-- Cài đặt: mức rút tối thiểu (VNĐ). Seed cũng ghi khóa này (on conflict do nothing).
insert into public.settings (key, value) values ('min_payout', to_jsonb(100000))
on conflict (key) do nothing;

-- Ví ------------------------------------------------------------------------------

create function public.partner_wallet(p_partner_id uuid)
returns table (earned bigint, pending_out bigint, paid bigint, available bigint)
language sql stable set search_path = public as $$
  with e as (
    select coalesce(sum(amount), 0)::bigint as v from public.commission_entries where partner_id = p_partner_id
  ), o as (
    select
      coalesce(sum(amount) filter (where status in ('requested', 'approved')), 0)::bigint as pending,
      coalesce(sum(amount) filter (where status = 'paid'), 0)::bigint as paid
    from public.payouts where partner_id = p_partner_id
  )
  select e.v, o.pending, o.paid, e.v - o.pending - o.paid from e, o
$$;

-- Yêu cầu rút ---------------------------------------------------------------------
-- p_min: mức tối thiểu (Server Action đọc setting min_payout). Trả id khoản chi mới.
create function public.request_payout(p_partner_id uuid, p_amount bigint, p_min bigint)
returns uuid
language plpgsql set search_path = public as $$
declare
  v_partner public.partners%rowtype;
  v_kind text;
  v_available bigint;
  v_id uuid;
begin
  -- Khóa ví: yêu cầu song song của cùng đối tác xếp hàng tại đây.
  select * into v_partner from public.partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found'; end if;
  if v_partner.status <> 'active' then raise exception 'not_active'; end if;
  select kind into v_kind from public.partner_tiers where id = v_partner.tier_id;
  if v_kind is distinct from 'commission' then raise exception 'not_commission'; end if;
  if coalesce(btrim(v_partner.bank_name), '') = '' or coalesce(btrim(v_partner.bank_account), '') = ''
    or coalesce(btrim(v_partner.bank_holder), '') = '' then
    raise exception 'missing_bank';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount < coalesce(p_min, 0) then
    raise exception 'below_min';
  end if;

  select w.available into v_available from public.partner_wallet(p_partner_id) w;
  if p_amount > v_available then raise exception 'insufficient_balance'; end if;

  insert into public.payouts (partner_id, amount, source, status, bank_name, bank_account, bank_holder, is_demo)
  values (p_partner_id, p_amount, 'request', 'requested',
    v_partner.bank_name, v_partner.bank_account, v_partner.bank_holder, v_partner.is_demo)
  returning id into v_id;
  return v_id;
end
$$;

-- Duyệt / từ chối -------------------------------------------------------------------
-- approve: requested → approved. reject: requested|approved → rejected (bắt buộc lý do);
-- tiền tự trở lại available vì rejected không nằm trong pending_out/paid.
create function public.decide_payout(p_payout_id uuid, p_action text, p_actor uuid, p_reason text)
returns void
language plpgsql set search_path = public as $$
declare
  v_status text;
begin
  select status into v_status from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'payout_not_found'; end if;

  if p_action = 'approve' then
    if v_status <> 'requested' then raise exception 'invalid_state'; end if;
    update public.payouts set status = 'approved', decided_by = p_actor, decided_at = now()
    where id = p_payout_id;
  elsif p_action = 'reject' then
    if v_status not in ('requested', 'approved') then raise exception 'invalid_state'; end if;
    if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required'; end if;
    update public.payouts set status = 'rejected', reject_reason = btrim(p_reason),
      decided_by = p_actor, decided_at = now()
    where id = p_payout_id;
  else
    raise exception 'invalid_action';
  end if;
end
$$;

-- Đánh dấu đã chuyển -------------------------------------------------------------------
-- requested|approved → paid, trả true. Đã paid: không làm gì, trả false (bấm hai lần / hai admin
-- cùng lúc — Server Action gỡ chứng từ vừa tải lên). rejected → invalid_state.
-- p_date: ngày chuyển, không được sau hôm nay (giờ VN).
create function public.mark_payout_paid(
  p_payout_id uuid, p_actor uuid, p_ref text, p_date date, p_proof_path text
) returns boolean
language plpgsql set search_path = public as $$
declare
  v_status text;
begin
  select status into v_status from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'payout_not_found'; end if;
  if v_status = 'paid' then return false; end if;
  if v_status not in ('requested', 'approved') then raise exception 'invalid_state'; end if;
  if coalesce(btrim(p_ref), '') = '' then raise exception 'ref_required'; end if;
  if p_date is null or p_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'invalid_date';
  end if;

  update public.payouts set
    status = 'paid', transfer_ref = btrim(p_ref), transferred_on = p_date,
    proof_path = nullif(btrim(p_proof_path), ''), paid_by = p_actor, paid_at = now(),
    decided_by = coalesce(decided_by, p_actor), decided_at = coalesce(decided_at, now())
  where id = p_payout_id;
  return true;
end
$$;

-- Đợt chi --------------------------------------------------------------------------------
-- Mỗi CTV active (bậc commission) có is_demo = p_is_demo, khóa theo thứ tự id;
-- amount = least(earned tới cutoff − pending_out − paid, available):
--   amount ≤ 0 → bỏ qua, không đếm (không có gì để chi);
--   0 < amount < p_min → skipped_below_min (kể cả thiếu ngân hàng);
--   amount ≥ p_min nhưng thiếu ngân hàng → skipped_no_bank;
--   còn lại → payout approved thuộc đợt (snapshot ngân hàng).
-- "Tới cutoff" = commission_entries.created_at < 00:00 giờ VN ngày sau cutoff_date.
-- least(…, available) để reversal sau cutoff không làm chi vượt số dư thật.
-- Lọc theo is_demo để đợt thử không chứa đối tác thật (xóa dữ liệu thử cascade theo đợt).
create function public.create_payout_batch(
  p_kind text, p_cutoff date, p_min bigint, p_actor uuid, p_note text, p_is_demo boolean default false
) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_batch uuid;
  v_until timestamptz := ((p_cutoff + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  v_p record;
  v_earned bigint;
  v_w record;
  v_amount bigint;
  v_created int := 0;
  v_no_bank int := 0;
  v_below int := 0;
begin
  if p_cutoff is null then raise exception 'invalid_date'; end if;

  insert into public.payout_batches (kind, cutoff_date, note, is_demo, created_by)
  values (p_kind, p_cutoff, nullif(btrim(p_note), ''), coalesce(p_is_demo, false), p_actor)
  returning id into v_batch;

  for v_p in
    select p.id, p.bank_name, p.bank_account, p.bank_holder
    from public.partners p
    join public.partner_tiers t on t.id = p.tier_id
    where p.status = 'active' and t.kind = 'commission' and p.is_demo = coalesce(p_is_demo, false)
    order by p.id
    for update of p
  loop
    select coalesce(sum(amount), 0)::bigint into v_earned
    from public.commission_entries where partner_id = v_p.id and created_at < v_until;
    select * into v_w from public.partner_wallet(v_p.id);
    v_amount := least(v_earned - v_w.pending_out - v_w.paid, v_w.available);

    if v_amount <= 0 then continue; end if;
    if v_amount < coalesce(p_min, 0) then
      v_below := v_below + 1;
      continue;
    end if;
    if coalesce(btrim(v_p.bank_name), '') = '' or coalesce(btrim(v_p.bank_account), '') = ''
      or coalesce(btrim(v_p.bank_holder), '') = '' then
      v_no_bank := v_no_bank + 1;
      continue;
    end if;

    insert into public.payouts (
      partner_id, amount, source, batch_id, status, bank_name, bank_account, bank_holder,
      decided_by, decided_at, is_demo
    ) values (
      v_p.id, v_amount, 'batch', v_batch, 'approved', v_p.bank_name, v_p.bank_account, v_p.bank_holder,
      p_actor, now(), coalesce(p_is_demo, false)
    );
    v_created := v_created + 1;
  end loop;

  return jsonb_build_object(
    'batch_id', v_batch, 'created', v_created,
    'skipped_no_bank', v_no_bank, 'skipped_below_min', v_below
  );
end
$$;

-- Quyền: chỉ service_role ------------------------------------------------------------------
revoke all on function
  public.partner_wallet(uuid),
  public.request_payout(uuid, bigint, bigint),
  public.decide_payout(uuid, text, uuid, text),
  public.mark_payout_paid(uuid, uuid, text, date, text),
  public.create_payout_batch(text, date, bigint, uuid, text, boolean)
from public, anon, authenticated;
grant execute on function
  public.partner_wallet(uuid),
  public.request_payout(uuid, bigint, bigint),
  public.decide_payout(uuid, text, uuid, text),
  public.mark_payout_paid(uuid, uuid, text, date, text),
  public.create_payout_batch(text, date, bigint, uuid, text, boolean)
to service_role;

-- ===== supabase/migrations/0007_demo_flag.sql =====
-- Dữ liệu đặt thử. Mọi thứ tạo ra bởi hoặc thông qua thực thể thử đều là thử, suy ra ở phía DB
-- (không tin client): đơn của đối tác thử, đơn có dòng hàng của nông dân thử, nông dân do đối tác
-- thử nhận. create_order còn nhận khóa p_order->>'is_demo' (mặc định false; chỉ code server của
-- admin đặt khóa này, luồng đặt hàng công khai không bao giờ đưa dữ liệu client vào p_order).
-- delete_demo_data() xóa nguyên khối (một giao dịch). create_order giữ nguyên chữ ký (jsonb, jsonb),
-- không đổi logic tạo đơn nào khác; revoke/grant tường minh ở cuối file.

create or replace function public.create_order(p_order jsonb, p_lines jsonb)
returns table (id uuid, code text)
language plpgsql set search_path = public as $$
#variable_conflict use_column
declare
  v_key uuid := nullif(p_order->>'client_key', '')::uuid;
  v_period text := to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM');
  v_seq int;
  v_id uuid;
  v_code text;
  v_demo boolean;
begin
  if v_key is not null then
    -- Hai lần gửi cùng client_key xếp hàng tại đây; lần sau thấy đơn đã commit
    -- và trả về đơn cũ mà không tiêu số thứ tự.
    perform pg_advisory_xact_lock(hashtextextended('create_order:' || v_key::text, 0));
    return query select o.id, o.code from public.orders o where o.client_key = v_key;
    if found then return; end if;
  end if;

  v_demo := coalesce((p_order->>'is_demo')::boolean, false)
    or exists (select 1 from public.partners pt
               where pt.id = nullif(p_order->>'partner_id', '')::uuid and pt.is_demo)
    or exists (select 1 from jsonb_populate_recordset(null::public.order_lines, p_lines) l
               join public.farmers f on f.id = l.farmer_id where f.is_demo);

  insert into public.order_counters as c (period, last) values (v_period, 1)
  on conflict (period) do update set last = c.last + 1
  returning c.last into v_seq;
  v_code := 'DH' || v_period || '-' || lpad(v_seq::text, 4, '0');

  insert into public.orders (
    code, client_key, client_ip, source, partner_id, delivery_address, payment_method,
    retail_name, retail_phone, retail_address, note, subtotal, partner_payable,
    commission_expected, total_qty, is_demo
  ) values (
    v_code, v_key, p_order->>'client_ip', p_order->>'source',
    nullif(p_order->>'partner_id', '')::uuid, p_order->>'delivery_address',
    coalesce(p_order->>'payment_method', 'cod'),
    p_order->>'retail_name', p_order->>'retail_phone', p_order->>'retail_address', p_order->>'note',
    coalesce((p_order->>'subtotal')::bigint, 0), (p_order->>'partner_payable')::bigint,
    coalesce((p_order->>'commission_expected')::bigint, 0),
    coalesce((select sum((l->>'qty')::int) from jsonb_array_elements(p_lines) l), 0),
    v_demo
  )
  returning orders.id into v_id;

  insert into public.order_lines (
    order_id, farmer_id, product_id, qty, list_price_snap, sale_price_snap, promotion_id_snap,
    rate_pct_snap, line_total, line_commission, line_partner_price
  )
  select v_id, l.farmer_id, l.product_id, l.qty, l.list_price_snap, l.sale_price_snap,
    l.promotion_id_snap, coalesce(l.rate_pct_snap, 0), l.line_total,
    coalesce(l.line_commission, 0), l.line_partner_price
  from jsonb_populate_recordset(null::public.order_lines, p_lines) l;

  insert into public.order_status_log (order_id, from_status, to_status, changed_by)
  values (v_id, null, 'new', nullif(p_order->>'actor', '')::uuid);

  return query select v_id, v_code;
end
$$;

-- Nông dân do đối tác thử nhận là nông dân thử.
create or replace function public.claim_farmer(
  p_partner_id uuid, p_phone text, p_name text, p_address text
) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_id uuid;
  v_owner uuid;
  v_demo boolean;
begin
  select is_demo into v_demo from public.partners where id = p_partner_id;
  insert into public.farmers (phone, name, address, owner_partner_id, is_demo)
  values (p_phone, p_name, p_address, p_partner_id, coalesce(v_demo, false))
  on conflict (phone) do nothing
  returning id into v_id;
  if v_id is not null then
    return jsonb_build_object('status', 'ok', 'farmer_id', v_id);
  end if;

  select id, owner_partner_id into v_id, v_owner from public.farmers where phone = p_phone for update;
  if v_owner is null then
    update public.farmers set owner_partner_id = p_partner_id where id = v_id;
  elsif v_owner <> p_partner_id then
    return jsonb_build_object('status', 'owned_by_other');
  end if;
  return jsonb_build_object('status', 'ok', 'farmer_id', v_id);
end
$$;

-- Xóa toàn bộ dữ liệu thử trong MỘT giao dịch, theo thứ tự khóa ngoại. Còn bản ghi thật tham
-- chiếu tới dữ liệu thử → lỗi 23503 (foreign_key_violation) và hoàn tác toàn bộ.
-- Trả về số bản ghi đã xóa và user_id (auth) của đối tác thử để Server Action xóa tài khoản.
create or replace function public.delete_demo_data() returns jsonb
language plpgsql set search_path = public as $$
declare
  v_users uuid[];
  v_payouts int;
  v_batches int;
  v_orders int;
  v_farmers int;
  v_partners int;
begin
  select coalesce(array_agg(user_id), '{}') into v_users from public.partners where is_demo;

  delete from public.payouts
  where is_demo or partner_id in (select id from public.partners where is_demo);
  get diagnostics v_payouts = row_count;
  delete from public.payout_batches where is_demo;
  get diagnostics v_batches = row_count;

  delete from public.order_status_log where order_id in (select id from public.orders where is_demo);
  delete from public.order_lines where order_id in (select id from public.orders where is_demo);
  delete from public.commission_entries
  where order_id in (select id from public.orders where is_demo)
    or partner_id in (select id from public.partners where is_demo);
  delete from public.orders where is_demo;
  get diagnostics v_orders = row_count;

  delete from public.farmers where is_demo;
  get diagnostics v_farmers = row_count;
  delete from public.partners where is_demo;
  get diagnostics v_partners = row_count;

  return jsonb_build_object(
    'payouts', v_payouts, 'payout_batches', v_batches, 'orders', v_orders,
    'farmers', v_farmers, 'partners', v_partners, 'user_ids', to_jsonb(v_users)
  );
end
$$;

revoke all on function
  public.create_order(jsonb, jsonb),
  public.claim_farmer(uuid, text, text, text),
  public.delete_demo_data()
from public, anon, authenticated;
grant execute on function
  public.create_order(jsonb, jsonb),
  public.claim_farmer(uuid, text, text, text),
  public.delete_demo_data()
to service_role;

-- ===== supabase/migrations/0008_legacy_paid.sql =====
-- Hoa hồng đã chi theo cách cũ (commission_entries.status = 'paid', trước khi có ví) được ghi
-- thành MỘT khoản chi `paid` mỗi đối tác (source 'legacy', mã GD 'LEGACY-TRUOC-VI') để ví không
-- tính lại số tiền đó là khả dụng. Chạy lại không thêm gì: bỏ qua đối tác đã có khoản legacy.
-- Sau khi chạy, đừng dùng nút "Đã chi" cũ nữa (bản mới đã bỏ nút này).

alter table public.payouts drop constraint if exists payouts_source_check;
alter table public.payouts add constraint payouts_source_check
  check (source in ('request', 'batch', 'legacy'));

insert into public.payouts (
  partner_id, amount, source, status, transfer_ref, transferred_on,
  requested_at, decided_at, paid_at, is_demo
)
select ce.partner_id, sum(ce.amount), 'legacy', 'paid', 'LEGACY-TRUOC-VI',
  (coalesce(max(ce.paid_at), now()) at time zone 'Asia/Ho_Chi_Minh')::date,
  coalesce(max(ce.paid_at), now()), coalesce(max(ce.paid_at), now()), coalesce(max(ce.paid_at), now()),
  bool_or(pt.is_demo)
from public.commission_entries ce
join public.partners pt on pt.id = ce.partner_id
where ce.status = 'paid'
  and not exists (
    select 1 from public.payouts p where p.partner_id = ce.partner_id and p.source = 'legacy'
  )
group by ce.partner_id
having sum(ce.amount) > 0;

-- ===== bucket chứng từ chi trả (riêng tư) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payout-proofs', 'payout-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

commit;
