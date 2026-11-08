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
-- requested|approved → paid. Đã paid: không làm gì (bấm hai lần). rejected → invalid_state.
-- p_date: ngày chuyển, không được sau hôm nay (giờ VN).
create function public.mark_payout_paid(
  p_payout_id uuid, p_actor uuid, p_ref text, p_date date, p_proof_path text
) returns void
language plpgsql set search_path = public as $$
declare
  v_status text;
begin
  select status into v_status from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'payout_not_found'; end if;
  if v_status = 'paid' then return; end if;
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
end
$$;

-- Đợt chi --------------------------------------------------------------------------------
-- Mỗi CTV active (bậc commission) có is_demo = p_is_demo, khóa theo thứ tự id:
--   thiếu ngân hàng → skipped_no_bank;
--   amount = least(earned tới cutoff − pending_out − paid, available) < p_min → skipped_below_min;
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
    if coalesce(btrim(v_p.bank_name), '') = '' or coalesce(btrim(v_p.bank_account), '') = ''
      or coalesce(btrim(v_p.bank_holder), '') = '' then
      v_no_bank := v_no_bank + 1;
      continue;
    end if;

    select coalesce(sum(amount), 0)::bigint into v_earned
    from public.commission_entries where partner_id = v_p.id and created_at < v_until;
    select * into v_w from public.partner_wallet(v_p.id);
    v_amount := least(v_earned - v_w.pending_out - v_w.paid, v_w.available);

    if v_amount <= 0 or v_amount < coalesce(p_min, 0) then
      v_below := v_below + 1;
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
