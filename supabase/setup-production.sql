-- Cài đặt CSDL cho Supabase bản thật: chạy MỘT LẦN trong SQL Editor của dự án mới (trống).
-- Gồm migrations 0001–0006, dữ liệu (nhóm, sản phẩm, bậc đối tác, tỷ lệ, cài đặt), bucket ảnh
-- 'products' (công khai) và bucket chứng từ chi trả 'payout-proofs' (riêng tư).
-- Sinh tự động bởi scripts/gen-seed.ts từ data/*.json (npm run data:gen) — không sửa tay.
-- Dự án đang chạy (đã có dữ liệu cũ): chạy từng migration còn thiếu (0005, 0006, …) và
-- data-update-production.sql (một lần, xem README); bucket 'payout-proofs' tạo bằng câu lệnh cuối file này.
begin;

-- ===== supabase/migrations/0001_schema.sql =====
-- Lược đồ chính. Tiền: bigint (VNĐ nguyên). Tỷ lệ: numeric(5,2) (%).

create type public.order_status as enum
  ('new', 'confirmed', 'shipping', 'delivered', 'paid', 'cancelled', 'returned');

-- Catalog -------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  unit text not null,
  category_id uuid not null references public.categories(id),
  list_price bigint not null check (list_price >= 0),
  image_url text,
  in_stock boolean not null default true,
  is_active boolean not null default true,
  description text,
  updated_price_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);

-- Ghi lại thời điểm đổi giá (trang "sản phẩm đổi giá 14 ngày gần nhất").
create function public.products_touch_price() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.list_price is distinct from old.list_price then
    new.updated_price_at := now();
  end if;
  return new;
end
$$;
create trigger products_touch_price before update on public.products
  for each row execute function public.products_touch_price();

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null check (scope in ('product', 'category')),
  target_id uuid not null,
  type text not null check (type in ('percent', 'fixed_price')),
  value numeric(14,2) not null check (value >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  check (type <> 'fixed_price' or scope = 'product'),
  check (type <> 'percent' or value <= 100),
  check (ends_at > starts_at)
);

-- Bậc đối tác & tỷ lệ --------------------------------------------------------

create table public.partner_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('commission', 'wholesale'))
);

create table public.tier_rates (
  tier_id uuid not null references public.partner_tiers(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  rate_pct numeric(5,2) not null check (rate_pct between 0 and 100),
  primary key (tier_id, category_id)
);

create table public.tier_product_rates (
  tier_id uuid not null references public.partner_tiers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  rate_pct numeric(5,2) not null check (rate_pct between 0 and 100),
  primary key (tier_id, product_id)
);

-- Người dùng ----------------------------------------------------------------

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  phone text not null unique check (phone ~ '^0[0-9]{9,10}$'),
  name text not null,
  region text,
  delivery_address text,
  tier_id uuid references public.partner_tiers(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'locked')),
  created_at timestamptz not null default now()
);

create table public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'staff'))
);

create table public.farmers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^0[0-9]{9,10}$'),
  name text not null,
  address text,
  owner_partner_id uuid references public.partners(id),
  created_at timestamptz not null default now()
);
create index farmers_owner_idx on public.farmers(owner_partner_id);

create table public.farmer_transfer_log (
  id bigint generated always as identity primary key,
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  from_partner_id uuid references public.partners(id),
  to_partner_id uuid references public.partners(id),
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index farmer_transfer_log_farmer_idx on public.farmer_transfer_log(farmer_id);

-- Đơn hàng ------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_key uuid unique,
  client_ip text,
  source text not null check (source in ('partner', 'retail')),
  partner_id uuid references public.partners(id),
  status public.order_status not null default 'new',
  delivery_address text,
  payment_method text not null default 'cod' check (payment_method in ('cod', 'transfer')),
  retail_name text,
  retail_phone text check (retail_phone ~ '^0[0-9]{9,10}$'),
  retail_address text,
  note text,
  subtotal bigint not null default 0 check (subtotal >= 0),
  partner_payable bigint check (partner_payable >= 0),
  commission_expected bigint not null default 0 check (commission_expected >= 0),
  total_qty int not null default 0 check (total_qty >= 0),
  created_at timestamptz not null default now(),
  check (source <> 'partner' or partner_id is not null),
  check (source <> 'retail' or (retail_name is not null and retail_phone is not null))
);
create index orders_partner_idx on public.orders(partner_id, created_at desc);
create index orders_status_idx on public.orders(status, created_at desc);
create index orders_created_idx on public.orders(created_at desc);
create index orders_retail_phone_idx on public.orders(retail_phone, created_at desc);
create index orders_client_ip_idx on public.orders(client_ip, created_at desc);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  farmer_id uuid references public.farmers(id),
  product_id uuid not null references public.products(id),
  qty int not null check (qty > 0),
  list_price_snap bigint not null check (list_price_snap >= 0),
  sale_price_snap bigint not null check (sale_price_snap >= 0),
  promotion_id_snap uuid,
  rate_pct_snap numeric(5,2) not null default 0,
  line_total bigint not null check (line_total >= 0),
  line_commission bigint not null default 0 check (line_commission >= 0),
  line_partner_price bigint check (line_partner_price >= 0)
);
create index order_lines_order_idx on public.order_lines(order_id);
create index order_lines_product_idx on public.order_lines(product_id);
create index order_lines_farmer_idx on public.order_lines(farmer_id);

create table public.order_status_log (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  note text
);
create index order_status_log_order_idx on public.order_status_log(order_id, changed_at);

-- Số thứ tự mã đơn theo tháng (YYMM giờ VN).
create table public.order_counters (
  period text primary key,
  last int not null default 0
);

-- Hoa hồng ------------------------------------------------------------------

create table public.commission_entries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  order_id uuid not null references public.orders(id),
  kind text not null check (kind in ('earn', 'reversal')),
  amount bigint not null,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (order_id, kind)
);
create index commission_entries_partner_idx on public.commission_entries(partner_id, period);
create index commission_entries_period_idx on public.commission_entries(period, status);

-- Cài đặt (store_name, bank_info, notify_email, telegram_chat_id, zalo_link) --

create table public.settings (
  key text primary key,
  value jsonb not null
);

-- ===== supabase/migrations/0002_rls.sql =====
-- Phân quyền đọc. Mọi thao tác ghi đi qua service_role (Server Actions / RPC):
-- anon/authenticated chỉ có SELECT, không có policy INSERT/UPDATE/DELETE.

-- Hàm trợ giúp (security definer để không vướng RLS khi dùng trong policy) ---

create function public.current_partner_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.partners where user_id = auth.uid() and status = 'active'
$$;

create function public.current_tier_id() returns uuid
language sql stable security definer set search_path = public as $$
  select tier_id from public.partners where user_id = auth.uid() and status = 'active'
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin')
$$;

-- Ngoại lệ có chủ ý với quy tắc "RPC chỉ service_role": bốn hàm trợ giúp này phải
-- giữ EXECUTE cho anon/authenticated vì policy RLS gọi chúng dưới vai trò người dùng.
-- Chúng chỉ trả thông tin về chính người gọi (auth.uid()).
revoke all on function public.current_partner_id(), public.current_tier_id(),
  public.is_staff(), public.is_admin() from public;
grant execute on function public.current_partner_id(), public.current_tier_id(),
  public.is_staff(), public.is_admin() to anon, authenticated, service_role;
revoke all on function public.products_touch_price() from public, anon, authenticated;

-- Quyền bảng ----------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Quyền mặc định cho bảng/hàm tạo ở migration sau (0003+): anon/authenticated chỉ
-- SELECT bảng, không USAGE sequence, không EXECUTE hàm; hàm mới phải grant rõ ràng.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  grant select on tables to anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
-- EXECUTE mặc định cho PUBLIC chỉ thu hồi được ở mức toàn cục (không theo schema).
alter default privileges for role postgres revoke execute on functions from public;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.promotions enable row level security;
alter table public.partner_tiers enable row level security;
alter table public.tier_rates enable row level security;
alter table public.tier_product_rates enable row level security;
alter table public.partners enable row level security;
alter table public.staff enable row level security;
alter table public.farmers enable row level security;
alter table public.farmer_transfer_log enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.order_status_log enable row level security;
alter table public.order_counters enable row level security;
alter table public.commission_entries enable row level security;
alter table public.settings enable row level security;

-- Công khai -----------------------------------------------------------------

create policy categories_read on public.categories for select
  to anon, authenticated using (true);

create policy products_read on public.products for select
  to anon, authenticated using (is_active or (select public.is_staff()));

create policy promotions_read on public.promotions for select
  to anon, authenticated using (is_active or (select public.is_staff()));

create policy settings_read on public.settings for select
  to anon, authenticated
  using (key in ('store_name', 'bank_info', 'zalo_link') or (select public.is_staff()));

-- Đối tác (chỉ dữ liệu của mình; pending/locked không có current_partner_id) --

create policy partners_read on public.partners for select
  to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy partner_tiers_read on public.partner_tiers for select
  to authenticated using (id = (select public.current_tier_id()) or (select public.is_staff()));

create policy tier_rates_read on public.tier_rates for select
  to authenticated using (tier_id = (select public.current_tier_id()) or (select public.is_staff()));

create policy tier_product_rates_read on public.tier_product_rates for select
  to authenticated using (tier_id = (select public.current_tier_id()) or (select public.is_staff()));

create policy farmers_read on public.farmers for select
  to authenticated using (owner_partner_id = (select public.current_partner_id()) or (select public.is_staff()));

create policy orders_read on public.orders for select
  to authenticated using (partner_id = (select public.current_partner_id()) or (select public.is_staff()));

create policy order_lines_read on public.order_lines for select
  to authenticated using (
    (select public.is_staff())
    or order_id in (select id from public.orders where partner_id = (select public.current_partner_id()))
  );

create policy commission_entries_read on public.commission_entries for select
  to authenticated using (partner_id = (select public.current_partner_id()) or (select public.is_staff()));

-- Nội bộ --------------------------------------------------------------------

create policy staff_read on public.staff for select
  to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy order_status_log_read on public.order_status_log for select
  to authenticated using ((select public.is_staff()));

create policy farmer_transfer_log_read on public.farmer_transfer_log for select
  to authenticated using ((select public.is_staff()));

create policy order_counters_read on public.order_counters for select
  to authenticated using ((select public.is_staff()));

-- ===== supabase/migrations/0003_functions.sql =====
-- Đường ghi nguyên tử: tạo đơn, đổi trạng thái (+ hoa hồng), sửa dòng hàng, khóa
-- khách theo CTV. Server Actions gọi qua client service role (.rpc()).
-- Lỗi nghiệp vụ dùng mã ngắn làm message (invalid_transition, not_editable, ...)
-- để supabase-js `error.message` chứa đúng mã đó.
-- Mọi hàm: security invoker (service_role đã có quyền bảng), chỉ service_role execute.

-- Tạo đơn ---------------------------------------------------------------------
-- p_order: source, partner_id, client_key, client_ip, delivery_address, payment_method,
--   retail_name, retail_phone, retail_address, note, subtotal, partner_payable,
--   commission_expected, actor (tùy chọn: auth user id ghi vào log null→new).
-- p_lines: mảng object khóa = tên cột order_lines (order_id/id bị bỏ qua).
create function public.create_order(p_order jsonb, p_lines jsonb)
returns table (id uuid, code text)
language plpgsql set search_path = public as $$
#variable_conflict use_column
declare
  v_key uuid := nullif(p_order->>'client_key', '')::uuid;
  v_period text := to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMM');
  v_seq int;
  v_id uuid;
  v_code text;
begin
  if v_key is not null then
    -- Hai lần gửi cùng client_key xếp hàng tại đây; lần sau thấy đơn đã commit
    -- và trả về đơn cũ mà không tiêu số thứ tự.
    perform pg_advisory_xact_lock(hashtextextended('create_order:' || v_key::text, 0));
    return query select o.id, o.code from public.orders o where o.client_key = v_key;
    if found then return; end if;
  end if;

  insert into public.order_counters as c (period, last) values (v_period, 1)
  on conflict (period) do update set last = c.last + 1
  returning c.last into v_seq;
  v_code := 'DH' || v_period || '-' || lpad(v_seq::text, 4, '0');

  insert into public.orders (
    code, client_key, client_ip, source, partner_id, delivery_address, payment_method,
    retail_name, retail_phone, retail_address, note, subtotal, partner_payable,
    commission_expected, total_qty
  ) values (
    v_code, v_key, p_order->>'client_ip', p_order->>'source',
    nullif(p_order->>'partner_id', '')::uuid, p_order->>'delivery_address',
    coalesce(p_order->>'payment_method', 'cod'),
    p_order->>'retail_name', p_order->>'retail_phone', p_order->>'retail_address', p_order->>'note',
    coalesce((p_order->>'subtotal')::bigint, 0), (p_order->>'partner_payable')::bigint,
    coalesce((p_order->>'commission_expected')::bigint, 0),
    coalesce((select sum((l->>'qty')::int) from jsonb_array_elements(p_lines) l), 0)
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

-- Đổi trạng thái --------------------------------------------------------------
-- Bảng chuyển khớp TRANSITIONS / canTransition trong lib/orders/status.ts.
create function public.change_order_status(
  p_order_id uuid, p_to public.order_status, p_actor uuid, p_actor_kind text, p_note text
) returns void
language plpgsql set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_ok boolean;
  v_earn public.commission_entries%rowtype;
  v_period text := to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM');
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status = p_to then return; end if;

  if p_actor_kind = 'partner' then
    v_ok := v_order.status = 'new' and p_to = 'cancelled';
  elsif p_actor_kind = 'staff' then
    v_ok := (v_order.status, p_to) in (
      ('new', 'confirmed'), ('new', 'cancelled'),
      ('confirmed', 'shipping'), ('confirmed', 'cancelled'),
      ('shipping', 'delivered'), ('shipping', 'cancelled'),
      ('delivered', 'paid'), ('delivered', 'returned'),
      ('paid', 'returned')
    );
  else
    raise exception 'invalid_actor_kind';
  end if;
  if not v_ok then raise exception 'invalid_transition'; end if;

  update public.orders set status = p_to where id = p_order_id;
  insert into public.order_status_log (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, v_order.status, p_to, p_actor, p_note);

  if p_to = 'paid' and v_order.commission_expected > 0 and v_order.partner_id is not null then
    insert into public.commission_entries (partner_id, order_id, kind, amount, period, status)
    values (v_order.partner_id, p_order_id, 'earn', v_order.commission_expected, v_period, 'pending')
    on conflict (order_id, kind) do nothing;
  elsif p_to = 'returned' then
    select * into v_earn from public.commission_entries where order_id = p_order_id and kind = 'earn';
    if found then
      insert into public.commission_entries (partner_id, order_id, kind, amount, period, status)
      values (v_earn.partner_id, p_order_id, 'reversal', -v_earn.amount, v_period, 'pending')
      on conflict (order_id, kind) do nothing;
    end if;
  end if;
end
$$;

-- Sửa dòng hàng -----------------------------------------------------------------
-- Partner chỉ khi `new`; staff khi `new|confirmed`. p_totals: subtotal,
-- partner_payable, commission_expected (server đã tính lại).
create function public.replace_order_lines(
  p_order_id uuid, p_lines jsonb, p_totals jsonb, p_actor uuid, p_actor_kind text
) returns void
language plpgsql set search_path = public as $$
declare
  v_status public.order_status;
begin
  select status into v_status from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if not (
    (p_actor_kind = 'partner' and v_status = 'new')
    or (p_actor_kind = 'staff' and v_status in ('new', 'confirmed'))
  ) then
    raise exception 'not_editable';
  end if;

  delete from public.order_lines where order_id = p_order_id;
  insert into public.order_lines (
    order_id, farmer_id, product_id, qty, list_price_snap, sale_price_snap, promotion_id_snap,
    rate_pct_snap, line_total, line_commission, line_partner_price
  )
  select p_order_id, l.farmer_id, l.product_id, l.qty, l.list_price_snap, l.sale_price_snap,
    l.promotion_id_snap, coalesce(l.rate_pct_snap, 0), l.line_total,
    coalesce(l.line_commission, 0), l.line_partner_price
  from jsonb_populate_recordset(null::public.order_lines, p_lines) l;

  update public.orders set
    subtotal = coalesce((p_totals->>'subtotal')::bigint, 0),
    partner_payable = (p_totals->>'partner_payable')::bigint,
    commission_expected = coalesce((p_totals->>'commission_expected')::bigint, 0),
    total_qty = coalesce((select sum((l->>'qty')::int) from jsonb_array_elements(p_lines) l), 0)
  where id = p_order_id;
end
$$;

-- Khóa khách theo CTV -------------------------------------------------------------
-- p_phone đã qua normalizePhone. Không bao giờ trả thông tin CTV chủ khác.
create function public.claim_farmer(
  p_partner_id uuid, p_phone text, p_name text, p_address text
) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_id uuid;
  v_owner uuid;
begin
  insert into public.farmers (phone, name, address, owner_partner_id)
  values (p_phone, p_name, p_address, p_partner_id)
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

create function public.transfer_farmer(p_farmer_id uuid, p_to_partner uuid, p_actor uuid)
returns void
language plpgsql set search_path = public as $$
declare
  v_from uuid;
begin
  select owner_partner_id into v_from from public.farmers where id = p_farmer_id for update;
  if not found then raise exception 'farmer_not_found'; end if;
  update public.farmers set owner_partner_id = p_to_partner where id = p_farmer_id;
  insert into public.farmer_transfer_log (farmer_id, from_partner_id, to_partner_id, changed_by)
  values (p_farmer_id, v_from, p_to_partner, p_actor);
end
$$;

-- Giới hạn tần suất đơn lẻ: số đơn retail cùng SĐT hoặc cùng IP trong 10 phút.
create function public.retail_recent_count(p_phone text, p_ip text) returns int
language sql stable set search_path = public as $$
  select count(*)::int from public.orders
  where source = 'retail'
    and created_at > now() - interval '10 minutes'
    and (retail_phone = p_phone or client_ip = p_ip)
$$;

-- Quyền: chỉ service_role (ghi rõ để giữ ý định trên Supabase hosted) -----------
revoke all on function
  public.create_order(jsonb, jsonb),
  public.change_order_status(uuid, public.order_status, uuid, text, text),
  public.replace_order_lines(uuid, jsonb, jsonb, uuid, text),
  public.claim_farmer(uuid, text, text, text),
  public.transfer_farmer(uuid, uuid, uuid),
  public.retail_recent_count(text, text)
from public, anon, authenticated;
grant execute on function
  public.create_order(jsonb, jsonb),
  public.change_order_status(uuid, public.order_status, uuid, text, text),
  public.replace_order_lines(uuid, jsonb, jsonb, uuid, text),
  public.claim_farmer(uuid, text, text, text),
  public.transfer_farmer(uuid, uuid, uuid),
  public.retail_recent_count(text, text)
to service_role;

-- ===== supabase/migrations/0004_phone_check.sql =====
-- Siết check SĐT: sau số 0 đầu phải là chữ số khác 0 (chặn dạng '009…' do nhập "+84 0912…"),
-- khớp normalizePhone (lib/phone.ts). Tên ràng buộc là tên Postgres tự đặt ở 0001.
alter table public.partners drop constraint partners_phone_check;
alter table public.partners add constraint partners_phone_check check (phone ~ '^0[1-9][0-9]{8,9}$');

alter table public.farmers drop constraint farmers_phone_check;
alter table public.farmers add constraint farmers_phone_check check (phone ~ '^0[1-9][0-9]{8,9}$');

alter table public.orders drop constraint orders_retail_phone_check;
alter table public.orders add constraint orders_retail_phone_check check (retail_phone ~ '^0[1-9][0-9]{8,9}$');

-- ===== supabase/migrations/0005_product_details.sql =====
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

-- ===== supabase/seed.sql =====
-- Sinh tự động bởi scripts/gen-seed.ts từ data/*.json (npm run data:gen) — không sửa tay.
-- Dữ liệu cho local/test: nhóm (slug, ảnh), sản phẩm (giá tham khảo thị trường), 2 bậc đối tác
-- kèm tỷ lệ theo nhóm (và 1 mức riêng theo sản phẩm), tên cửa hàng, mức rút tối thiểu.
-- Không tạo user (auth.users giữ nguyên qua db:reset).

insert into public.categories (slug, name, sort_order, image_url) values
  ('npk', 'Phân NPK', 1, 'https://images.pexels.com/photos/31673795/pexels-photo-31673795.jpeg?auto=compress&cs=tinysrgb&w=1600'),
  ('phan-don', 'Phân đơn (Urê, DAP, Kali)', 2, 'https://images.pexels.com/photos/15388810/pexels-photo-15388810.jpeg?auto=compress&cs=tinysrgb&w=1600'),
  ('huu-co', 'Phân hữu cơ', 3, 'https://images.unsplash.com/photo-1584747420644-5c767eebcbe6?auto=format&fit=crop&w=1600&q=80'),
  ('phan-bon-la', 'Phân bón lá & vi lượng', 4, 'https://images.unsplash.com/photo-1604595031526-1c468db04a1c?auto=format&fit=crop&w=1600&q=80'),
  ('thuoc-bvtv', 'Thuốc BVTV', 5, 'https://images.unsplash.com/photo-1711900177627-1182b446bc8f?auto=format&fit=crop&w=1600&q=80'),
  ('vat-tu', 'Vật tư nông nghiệp', 6, 'https://images.unsplash.com/photo-1645727527942-f12e14a0c841?auto=format&fit=crop&w=1600&q=80');

insert into public.products (sku, name, brand, unit, category_id, list_price, short_desc, composition, benefits, usage, crops, is_featured)
select v.sku, v.name, v.brand, v.unit, c.id, v.list_price, v.short_desc, v.composition, v.benefits, v.usage, v.crops, v.is_featured
from (values
  ('NPK-DT-20-20-15-50', 'Phân NPK Đầu Trâu 20-20-15+TE', 'Bình Điền (Đầu Trâu)', 'bao 50kg', 'npk', 910000, 'NPK hàm lượng cao, cân đối đạm – lân – kali, kèm vi lượng; hợp bón thúc lúa, rau màu và cây ăn trái.', 'Đạm (N) 20% – Lân (P₂O₅) 20% – Kali (K₂O) 15%, bổ sung trung vi lượng (TE).', E'Tổng dinh dưỡng 55%, bón ít mà đủ chất.\nĐạm và lân cao giúp cây đẻ nhánh, ra rễ, phát lộc nhanh.\nKali hỗ trợ cứng cây, nuôi hạt và trái.\nVi lượng đi kèm giúp lá xanh bền, hạn chế vàng lá.', E'Lúa: bón thúc 100–150 kg/ha mỗi lần, giai đoạn đẻ nhánh và làm đòng.\nRau màu: 300–500 kg/ha/vụ, chia 3–4 lần.\nCà phê, sầu riêng, cây ăn trái: 0,5–1,5 kg/cây/lần, 3–4 lần/năm tùy tuổi cây.\nRải quanh tán, lấp nhẹ và tưới ẩm sau khi bón.', array['Lúa', 'Rau màu', 'Cà phê', 'Sầu riêng', 'Cây ăn trái']::text[], true),
  ('NPK-DT-16-16-8-50', 'Phân NPK Đầu Trâu 16-16-8+TE', 'Bình Điền (Đầu Trâu)', 'bao 50kg', 'npk', 710000, 'NPK đa dụng cho bón lót và bón thúc đầu vụ, có thêm trung vi lượng giúp bộ rễ khỏe.', 'Đạm (N) 16% – Lân (P₂O₅) 16% – Kali (K₂O) 8%, bổ sung trung vi lượng (TE).', E'Tỷ lệ đạm – lân bằng nhau, hợp giai đoạn cây con và đẻ nhánh.\nThúc rễ phát triển, cây bén đất nhanh sau gieo trồng.\nDễ phối hợp với kali đơn khi vào giai đoạn nuôi trái.', E'Lúa: bón lót hoặc thúc đẻ nhánh 150–200 kg/ha.\nNgô, rau màu: 200–300 kg/ha, chia 2–3 lần.\nCây ăn trái, cà phê: 0,5–1 kg/cây/lần sau thu hoạch và đầu mùa mưa.', array['Lúa', 'Ngô', 'Rau màu', 'Cà phê', 'Cây ăn trái']::text[], false),
  ('NPK-PM-16-16-8-50', 'Phân NPK Phú Mỹ 16-16-8+13S', 'Phú Mỹ (PVFCCo)', 'bao 50kg', 'npk', 700000, 'NPK một hạt có thêm 13% lưu huỳnh, tan đều, dùng tốt cho lúa, ngô, rau và cây công nghiệp.', 'Đạm (N) 16% – Lân (P₂O₅) 16% – Kali (K₂O) 8% – Lưu huỳnh (S) 13%.', E'Mỗi hạt đủ cả N, P, K nên rải đồng đều, không bị phân lớp.\nLưu huỳnh giúp cây tổng hợp đạm tốt, lá xanh, hạt chắc.\nPhù hợp đất phèn nhẹ và đất thiếu lưu huỳnh.', E'Lúa: 150–250 kg/ha/vụ, chia bón lót và thúc đẻ nhánh.\nNgô, rau màu: 250–350 kg/ha/vụ, chia 2–3 lần.\nCà phê, hồ tiêu, cây ăn trái: 0,5–1 kg/cây/lần, 3–4 lần/năm.', array['Lúa', 'Ngô', 'Rau màu', 'Cà phê', 'Hồ tiêu']::text[], true),
  ('NPK-CM-16-16-8-50', 'Phân NPK Cà Mau 16-16-8', 'Phân bón Cà Mau (PVCFC)', 'bao 50kg', 'npk', 705000, 'NPK một hạt của Đạm Cà Mau, cân đối dinh dưỡng cho giai đoạn đầu và giữa vụ.', 'Đạm (N) 16% – Lân (P₂O₅) 16% – Kali (K₂O) 8%.', E'Hạt đồng đều, rải máy hoặc rải tay đều dễ.\nĐạm – lân cao giúp cây phát triển rễ, thân lá mạnh.\nGiúp giảm số lần trộn phân đơn tại ruộng.', E'Lúa: 150–200 kg/ha mỗi lần bón lót hoặc thúc đẻ nhánh.\nRau màu: 200–300 kg/ha/vụ, chia nhiều lần.\nCây ăn trái: 0,5–1 kg/cây/lần, bón quanh tán rồi tưới ẩm.', array['Lúa', 'Rau màu', 'Cây ăn trái']::text[], false),
  ('NPK-BCC-20-20-15-50', 'Phân NPK Con Cò 20-20-15', 'Baconco', 'bao 50kg', 'npk', 885000, 'NPK cao cấp hãng Con Cò, dinh dưỡng đậm đặc cho cây cần thúc mạnh: lúa, rau, cây ăn trái.', 'Đạm (N) 20% – Lân (P₂O₅) 20% – Kali (K₂O) 15%.', E'Hàm lượng dinh dưỡng cao, tiết kiệm công vận chuyển và bón.\nThúc cây ra rễ, đâm chồi, lá to dày.\nKali vừa đủ giúp cây cứng, ít đổ ngã.', E'Lúa: bón thúc 100–150 kg/ha mỗi lần.\nRau ăn lá, rau ăn trái: 300–400 kg/ha/vụ, chia 3–4 lần.\nSầu riêng, cà phê, cây ăn trái: 0,5–1,5 kg/cây/lần tùy tuổi cây.', array['Lúa', 'Rau màu', 'Sầu riêng', 'Cà phê', 'Cây ăn trái']::text[], false),
  ('NPK-VN-16-16-8-50', 'Phân NPK Việt Nhật 16-16-8', 'Phân bón Việt Nhật (JVF)', 'bao 50kg', 'npk', 630000, 'NPK phổ thông giá hợp lý, dùng bón lót và thúc sớm cho lúa, ngô, rau màu.', 'Đạm (N) 16% – Lân (P₂O₅) 16% – Kali (K₂O) 8%; có dòng bổ sung lưu huỳnh (S), xem nhãn bao.', E'Giá mềm, phù hợp diện tích lớn.\nCung cấp đạm, lân cân đối cho giai đoạn cây con.\nHạt cứng, ít vón cục khi bảo quản.', E'Lúa: 150–200 kg/ha mỗi lần bón lót hoặc thúc đẻ nhánh.\nNgô: 200–300 kg/ha, chia bón lót và thúc 4–6 lá.\nRau màu: 200–300 kg/ha/vụ, chia 2–3 lần.', array['Lúa', 'Ngô', 'Rau màu']::text[], false),
  ('URE-PM-46-50', 'Phân Urê Phú Mỹ', 'Phú Mỹ (PVFCCo)', 'bao 50kg', 'phan-don', 635000, 'Đạm urê hạt trong, hàm lượng đạm cao, giúp cây xanh lá, đẻ nhánh và lớn nhanh.', 'Đạm (N) ≥ 46%, biuret thấp.', E'Nguồn đạm đậm đặc nhất trong các loại phân đơn.\nThúc cây phát triển thân lá, đẻ nhánh khỏe.\nDễ phối trộn với lân, kali để tự pha công thức.', E'Lúa: 80–120 kg/ha/vụ, chia 2–3 lần (thúc đẻ nhánh, làm đòng).\nNgô: 150–250 kg/ha/vụ, chia 2–3 lần.\nRau màu: 100–150 kg/ha/vụ, rải hoặc hòa nước tưới.\nKhông bón khi trời sắp mưa to hoặc lúc nắng gắt để giảm thất thoát.', array['Lúa', 'Ngô', 'Rau màu', 'Cây ăn trái']::text[], true),
  ('URE-CM-46-50', 'Phân Urê Cà Mau', 'Phân bón Cà Mau (PVCFC)', 'bao 50kg', 'phan-don', 630000, 'Urê hạt đục của Đạm Cà Mau, hạt to, ít bụi, tan chậm hơn urê hạt trong.', 'Đạm (N) ≥ 46%, dạng hạt đục (granular).', E'Hạt to, cứng, rải máy đều, ít hút ẩm.\nĐạm giải phóng đều hơn, cây hấp thu tốt.\nPhổ biến ở Đồng bằng sông Cửu Long cho lúa và rau màu.', E'Lúa: 80–120 kg/ha/vụ, chia 2–3 lần.\nNgô, mía: 150–250 kg/ha/vụ, chia 2–3 lần.\nRau màu: 100–150 kg/ha/vụ, bón kèm lân và kali.', array['Lúa', 'Ngô', 'Mía', 'Rau màu']::text[], false),
  ('DAP-DV-18-46-50', 'Phân DAP Đình Vũ', 'DAP Vinachem (Đình Vũ)', 'bao 50kg', 'phan-don', 855000, 'Phân DAP sản xuất trong nước, giàu lân dễ tiêu kèm đạm, chuyên bón lót và kích rễ.', 'Diamoni photphat: Lân (P₂O₅) khoảng 45–46%, Đạm (N) khoảng 16–18% tùy dòng (xem nhãn bao).', E'Lân dễ tiêu giúp cây ra rễ mạnh, bén đất nhanh.\nĐạm đi kèm hỗ trợ cây con phát triển đều.\nThích hợp bón lót và bón giai đoạn phân hóa mầm hoa.', E'Lúa: bón lót 50–100 kg/ha.\nRau màu, ngô: bón lót 100–150 kg/ha.\nCà phê, cây ăn trái: 0,2–0,5 kg/cây/lần, đầu mùa mưa hoặc trước ra hoa.', array['Lúa', 'Ngô', 'Rau màu', 'Cà phê', 'Cây ăn trái']::text[], false),
  ('KALI-PM-60-50', 'Phân Kali bột Phú Mỹ (KCl)', 'Phú Mỹ (PVFCCo)', 'bao 50kg', 'phan-don', 530000, 'Kali clorua dạng bột đỏ, bổ sung kali cho giai đoạn làm đòng, nuôi hạt và nuôi trái.', 'Kali (K₂O) khoảng 60%, dạng kali clorua (KCl).', E'Giúp cây cứng, chống đổ ngã và chịu hạn tốt hơn.\nTăng độ chắc hạt, trọng lượng và độ ngọt của trái.\nTan nhanh, có thể rải hoặc hòa nước tưới.', E'Lúa: 50–100 kg/ha/vụ, tập trung bón thúc đòng.\nCà phê, sầu riêng, cây ăn trái: 0,3–1 kg/cây/lần giai đoạn nuôi trái.\nRau ăn củ, ăn trái: 100–150 kg/ha/vụ, chia 2–3 lần.\nHạn chế dùng cho cây kỵ clo như thuốc lá.', array['Lúa', 'Cà phê', 'Sầu riêng', 'Cây ăn trái', 'Rau màu']::text[], true),
  ('LAN-LT-SUPE-50', 'Phân Supe Lân Lâm Thao', 'Supe Phốt phát Lâm Thao', 'bao 50kg', 'phan-don', 310000, 'Supe lân đơn truyền thống, bổ sung lân, lưu huỳnh và canxi; chuyên bón lót cải tạo đất.', 'Lân hữu hiệu (P₂O₅) khoảng 16%, kèm lưu huỳnh (S) và canxi (Ca).', E'Kích thích ra rễ, giúp cây con khỏe ngay từ đầu vụ.\nCung cấp thêm lưu huỳnh và canxi cho đất.\nGiá rẻ, dễ phối trộn với phân chuồng khi ủ.', E'Lúa: bón lót 300–400 kg/ha trước khi bừa cấy.\nRau màu, đậu đỗ: bón lót 300–500 kg/ha.\nCây ăn trái, cà phê: 1–2 kg/cây/năm, trộn cùng phân hữu cơ bón quanh tán.', array['Lúa', 'Rau màu', 'Đậu đỗ', 'Cà phê', 'Cây ăn trái']::text[], false),
  ('HC-SF-TRUNQUE-25', 'Phân trùn quế cao cấp Sfarm PB01', 'Sfarm', 'bao 25kg', 'huu-co', 235000, 'Phân trùn quế nguyên chất đã qua xử lý, tơi xốp, không mùi; dùng trộn đất và bón gốc cho mọi loại cây.', '100% phân trùn quế đã xử lý, giàu mùn và vi sinh vật có lợi; pH trung tính.', E'Làm đất tơi xốp, giữ ẩm và thoáng khí cho rễ.\nCung cấp dinh dưỡng từ từ, không gây cháy rễ.\nAn toàn cho rau sạch, cây cảnh và vườn ươm.', E'Rau trồng chậu: trộn với đất theo tỷ lệ khoảng 4 phần phân – 6 phần đất; bón thêm lớp 1–2 cm mỗi 2 tuần.\nRau ngoài vườn: khoảng 1 kg/m², bón lót hoặc bón thúc.\nCây ăn trái: 2–5 kg/cây/lần, rải quanh tán rồi phủ nhẹ.', array['Rau màu', 'Cây ăn trái', 'Hoa kiểng', 'Cây ăn củ']::text[], true),
  ('HC-SF-PHANGA-25', 'Phân gà bột ủ vi sinh Sfarm', 'Sfarm', 'bao 25kg', 'huu-co', 220000, 'Phân gà đã ủ hoai bằng vi sinh, dạng bột mịn, dùng bón lót cải tạo đất cho rau và cây ăn trái.', 'Phân gà ủ hoai với chế phẩm vi sinh, giàu chất hữu cơ, đạm, lân và kali tự nhiên.', E'Đã ủ hoai nên hạn chế mầm bệnh và mùi hôi.\nBổ sung mùn, tăng vi sinh vật có ích trong đất.\nGiúp cây hấp thu phân vô cơ hiệu quả hơn.', E'Rau màu: bón lót 1–2 tấn/ha, trộn đều vào luống trước khi gieo.\nCây ăn trái, cà phê: 3–5 kg/cây/lần, 2 lần/năm.\nKhông bón sát gốc cây non; tưới ẩm sau khi bón.', array['Rau màu', 'Cây ăn trái', 'Cà phê', 'Sầu riêng']::text[], false),
  ('HC-GANHAT-15', 'Phân gà hữu cơ Nhật Bản nhập khẩu', 'Daily Egg (Nhật Bản) – Thiên Thảo Hân phân phối', 'bao 15kg', 'huu-co', 149000, 'Phân gà viên nhập khẩu từ Nhật, ủ khô, hàm lượng hữu cơ cao, dễ bón và ít mùi.', 'Phân gà ủ hoai: Đạm (N) ~3,5%, Lân (P₂O₅) ~4%, Kali (K₂O) ~2,9%; giàu chất hữu cơ.', E'Dạng viên khô, sạch, dễ vận chuyển và rải.\nCung cấp đa lượng tự nhiên và mùn cho đất.\nHợp cho vườn hữu cơ, rau sạch và cây cảnh.', E'Rau màu: bón lót 600–800 kg/ha; bón thúc 800–1.000 kg/ha trước khi ra hoa, đậu trái.\nCây ăn trái: 700–900 kg/ha/năm; cây non khoảng 250 g/cây.\nCây cảnh chậu: 10–100 g/chậu tùy kích thước, rải cách gốc 5–10 cm.\nKhông bón quá liều hoặc sát gốc.', array['Rau màu', 'Cây ăn trái', 'Hoa kiểng', 'Cây công nghiệp']::text[], false),
  ('HC-BACA-DAMCA-1L', 'Đạm cá Bà Cả (Fish Protein)', 'Nông nghiệp Bà Cả', 'chai 1 lít', 'huu-co', 180000, 'Dịch đạm cá thủy phân hữu cơ, giàu axit amin, giúp cây phục hồi, ra rễ và xanh lá tự nhiên.', 'Chất hữu cơ 20%, tỷ lệ C/N 12, pH 5; đạm cá thủy phân, axit amin, axit humic và fulvic.', E'Bổ sung đạm hữu cơ dễ hấp thu cho cây.\nKích thích rễ tơ, giúp cây hồi sức sau thu hoạch.\nCải thiện hệ vi sinh đất khi tưới gốc.', E'Tưới gốc: pha 30–50 ml cho bình 16 lít, 10–15 ngày/lần.\nSầu riêng, cây ăn trái: dùng sau thu hoạch và giai đoạn nuôi đọt.\nRau màu: pha loãng hơn, tưới 7–10 ngày/lần.\nXem thêm liều chi tiết trên nhãn chai.', array['Sầu riêng', 'Cây ăn trái', 'Rau màu', 'Hoa kiểng']::text[], false),
  ('LA-BACA-20-20-20-50G', 'Phân bón lá Baca Premium 20-20-20+TE', 'Nông nghiệp Bà Cả', 'gói 50g', 'phan-bon-la', 25000, 'Phân bón lá hòa tan NPK cân đối 20-20-20 kèm vi lượng, nhập khẩu Hà Lan, dùng được cho mọi loại cây.', 'Đạm (N) 20% – Lân (P₂O₅) 20% – Kali (K₂O) 20%; Cu 100 ppm, Mn 100 ppm, Zn 200 ppm.', E'Tan hoàn toàn, cây hấp thu nhanh qua lá.\nCân đối dinh dưỡng cho giai đoạn sinh trưởng mạnh.\nDùng được cả phun lá, tưới gốc và tưới nhỏ giọt.', E'Pha 1 gói 50 g với 30–40 lít nước.\nPhun ướt đều hai mặt lá hoặc tưới gốc, 7–10 ngày/lần.\nPhun lúc sáng sớm hoặc chiều mát.', array['Rau màu', 'Lúa', 'Cây ăn trái', 'Cây công nghiệp', 'Hoa kiểng']::text[], false),
  ('LA-BACA-12-52-6-50G', 'Phân bón lá Baca Premium 12-52-6+TE', 'Nông nghiệp Bà Cả', 'gói 50g', 'phan-bon-la', 25000, 'Phân bón lá lân cao, kích rễ và hỗ trợ phân hóa mầm hoa, nhập khẩu Hà Lan.', 'Đạm (N) 12% – Lân (P₂O₅) 52% – Kali (K₂O) 6%; Cu 100 ppm, Mn 100 ppm, Zn 200 ppm.', E'Lân rất cao giúp ra rễ mạnh cho cây con, cây mới trồng.\nHỗ trợ cây phân hóa mầm hoa, ra hoa đồng loạt.\nGiúp cây phục hồi sau ngập úng hoặc sau thu hoạch.', E'Pha 1 gói 50 g với 30–40 lít nước.\nPhun lá hoặc tưới gốc 7–10 ngày/lần, giai đoạn cây con và trước ra hoa.\nKhông phun lúc trời nắng gắt.', array['Cây ăn trái', 'Rau màu', 'Lúa', 'Hoa kiểng']::text[], false),
  ('LA-BOLY-OMNIKELP-1L', 'Phân bón lá rong biển Boly Omnikelp', 'Boly', 'chai 1 lít', 'phan-bon-la', 150000, 'Chiết xuất rong biển Úc giàu chất kích thích sinh trưởng tự nhiên, giúp cây khỏe, xanh lá, đậu trái.', 'Chiết xuất rong biển: chất hữu cơ 3%, Kali (K₂O) 1,5%; axit amin, vitamin và vi lượng tự nhiên.', E'Giúp cây ra rễ, đâm chồi và phục hồi sau thu hoạch.\nTăng khả năng chịu hạn, chịu mặn và thời tiết bất lợi.\nHỗ trợ đậu trái, trái đều và đẹp mã.', E'Phun lá: 1 lít pha với khoảng 800 lít nước/ha (tương đương 20 ml/bình 16 lít).\nRau, hoa: 8–10 ngày/lần; lúa: từ 7–10 ngày sau sạ đến giai đoạn nuôi hạt.\nCây ăn trái: 10–14 ngày/lần sau thu hoạch, ra hoa và nuôi trái.\nTưới gốc: 5–10 lít pha 5.000 lít nước/ha, 15–20 ngày/lần.', array['Lúa', 'Rau màu', 'Cây ăn trái', 'Sầu riêng', 'Hoa kiểng']::text[], true),
  ('LA-DK-HUMIC-1250', 'Phân bón lá Humic Gel Điền Khánh', 'Điền Khánh', 'chai 1,25 lít', 'phan-bon-la', 280000, 'Phân bón dạng gel kết hợp NPK, humic và vi lượng kẽm – bo; phun lá hoặc tưới gốc đều được.', 'Đạm (N) 8% – Lân (P₂O₅) 6% – Kali (K₂O) 7%; axit humic 8%; Zn 200 ppm, B 900 ppm.', E'Humic giúp kích rễ và tăng hiệu quả hấp thu phân bón.\nBo, kẽm hỗ trợ ra hoa, đậu trái, hạn chế rụng trái non.\nDạng gel đậm đặc, một chai pha được lượng nước lớn.', E'Pha 1 chai 1,25 lít với khoảng 400 lít nước.\nPhun đều tán lá hoặc tưới gốc vào các giai đoạn: sau thu hoạch, trước ra hoa và khi đậu trái.\nLặp lại 10–15 ngày/lần theo nhu cầu cây.', array['Cây ăn trái', 'Sầu riêng', 'Cà phê', 'Rau màu']::text[], false),
  ('BVTV-SYN-ANVIL-1L', 'Thuốc trừ bệnh Anvil 5SC', 'Syngenta', 'chai 1 lít', 'thuoc-bvtv', 285000, 'Thuốc trừ nấm phổ rộng gốc Hexaconazole, đặc trị khô vằn lúa, rỉ sắt và nấm hồng cà phê.', 'Hoạt chất Hexaconazole 50 g/lít, dạng huyền phù (SC).', E'Thuốc nội hấp, vừa phòng vừa trị nhiều bệnh nấm.\nHiệu quả với khô vằn, lem lép hạt trên lúa.\nTrị rỉ sắt, nấm hồng trên cà phê và ghẻ trên cây có múi.', E'Lúa (khô vằn, lem lép hạt): 40 ml/bình 16 lít, phun 2–2,5 bình cho 1.000 m².\nCà phê (rỉ sắt, nấm hồng): 500 ml/200 lít nước, phun 600–800 lít/ha khi bệnh mới xuất hiện.\nCây có múi (ghẻ): 300 ml/100 lít nước, phun lại sau 7 ngày.\nThời gian cách ly 14 ngày. Đọc kỹ nhãn, mang đồ bảo hộ khi phun.', array['Lúa', 'Cà phê', 'Ngô', 'Cây có múi']::text[], true),
  ('BVTV-BAY-NATIVO-120G', 'Thuốc trừ bệnh Nativo 750WG', 'Bayer', 'gói 120g', 'thuoc-bvtv', 342000, 'Thuốc trừ nấm hai hoạt chất, phòng trị đạo ôn, lem lép hạt, thán thư và rỉ sắt trên nhiều cây trồng.', 'Trifloxystrobin 250 g/kg + Tebuconazole 500 g/kg, dạng hạt phân tán (WG).', E'Kết hợp hai cơ chế tác động, giảm nguy cơ kháng thuốc.\nGiữ lá đòng xanh lâu, hạt lúa sáng, chắc.\nPhổ rộng: lúa, cà phê, hồ tiêu, đậu, khoai tây.', E'Lúa (đạo ôn, lem lép hạt, khô vằn): 6 g/bình 16 lít, phun 2 bình cho 1.000 m².\nCà phê (rỉ sắt): 40 g/100 lít nước.\nLạc, đậu tương (rỉ sắt): 200 g/ha.\nPhun khi bệnh mới xuất hiện; cách ly 7 ngày. Đọc kỹ nhãn, mang đồ bảo hộ khi phun.', array['Lúa', 'Cà phê', 'Hồ tiêu', 'Đậu đỗ', 'Khoai tây']::text[], false),
  ('BVTV-SYN-CHESS-20G', 'Thuốc trừ rầy Chess 50WG', 'Syngenta', 'gói 20g', 'thuoc-bvtv', 39000, 'Thuốc trừ rầy nâu, rầy lưng trắng, bọ phấn trên lúa và rầy bông, bọ trĩ trên xoài; khiến rầy ngừng chích hút.', 'Hoạt chất Pymetrozine 500 g/kg, dạng hạt phân tán (WG).', E'Rầy ngừng chích hút ngay sau khi trúng thuốc, hạn chế cháy rầy.\nLưu dẫn mạnh, hiệu lực kéo dài.\nÍt ảnh hưởng thiên địch so với nhiều thuốc trừ rầy khác.', E'Lúa (rầy nâu, rầy lưng trắng): 0,3–0,5 kg/ha; pha 7,5 g/bình 10 lít hoặc 20 g/bình 25 lít, phun khi rầy cám mới nở.\nXoài (rầy bông, bọ trĩ): 120–200 g/200 lít nước.\nThời gian cách ly 7 ngày. Đọc kỹ nhãn, mang đồ bảo hộ khi phun.', array['Lúa', 'Xoài']::text[], false),
  ('BVTV-FMC-PREVATHON-100', 'Thuốc trừ sâu Prevathon 200SC', 'FMC', 'chai 100ml', 'thuoc-bvtv', 185000, 'Thuốc trừ sâu gốc Chlorantraniliprole, đặc trị sâu cuốn lá, sâu đục thân lúa và sâu đục trái vải.', 'Hoạt chất Chlorantraniliprole 200 g/lít, dạng huyền phù (SC).', E'Sâu ngừng ăn nhanh sau khi nhiễm thuốc.\nHiệu lực kéo dài, giảm số lần phun trong vụ.\nÍt độc với ong và thiên địch khi dùng đúng liều.', E'Lúa (sâu cuốn lá, sâu đục thân): 150 ml/ha, pha với khoảng 400 lít nước; phun khi sâu tuổi nhỏ.\nVải (sâu đục cuống trái): 200 ml/100 lít nước, phun 600 lít/ha.\nĐọc kỹ nhãn, mang đồ bảo hộ khi phun.', array['Lúa', 'Vải']::text[], false),
  ('BVTV-SYN-SOFIT-1L', 'Thuốc trừ cỏ Sofit 300EC', 'Syngenta', 'chai 1 lít', 'thuoc-bvtv', 310000, 'Thuốc trừ cỏ tiền nảy mầm cho lúa sạ và lúa cấy, có chất an toàn giúp lúa không bị ngộ độc.', 'Pretilachlor 300 g/lít + chất an toàn Fenclorim 100 g/lít, dạng nhũ dầu (EC).', E'Diệt cỏ lồng vực, đuôi phụng, cỏ chác, cỏ lác ngay từ khi nảy mầm.\nFenclorim bảo vệ cây lúa non.\nMột lần phun giữ ruộng sạch cỏ giai đoạn đầu vụ.', E'Lúa sạ: phun 0–4 ngày sau sạ; lúa cấy: 0–5 ngày sau cấy.\nLiều 1–1,4 lít/ha: khoảng 70 ml/bình 16 lít, phun 20 bình/ha (300–400 lít nước).\nGiữ ruộng đủ ẩm, không để khô nứt sau phun.\nĐọc kỹ nhãn, mang đồ bảo hộ khi phun.', array['Lúa']::text[], false),
  ('BVTV-UPL-TARANG-900', 'Thuốc trừ cỏ Tarang 280SL', 'UPL', 'chai 900ml', 'thuoc-bvtv', 145000, 'Thuốc trừ cỏ không chọn lọc gốc Glufosinate, diệt nhanh cỏ lá rộng và cỏ hòa bản trong vườn cây.', 'Hoạt chất Glufosinate ammonium 280 g/lít, dạng dung dịch (SL).', E'Cỏ cháy nhanh sau vài ngày, dùng dọn vườn, bờ ruộng.\nDiệt được cỏ mần trầu, cỏ chỉ, rau dền, rau trai.\nTác động tiếp xúc, không lưu dẫn xuống rễ cây trồng.', E'Pha 60 ml/bình 16 lít hoặc 95 ml/bình 25 lít.\nPhun khi cỏ non cao 5–15 cm, trời khô ráo có nắng.\nPhun tránh tạt vào lá và thân xanh của cây trồng; không pha với nước phèn, nước đục.\nĐọc kỹ nhãn, mang đồ bảo hộ khi phun.', array['Cây ăn trái', 'Cà phê', 'Cây công nghiệp']::text[], false),
  ('VT-OSHIMA-BLV16', 'Bình xịt điện Oshima BLV 16 lít', 'Oshima', 'cái', 'vat-tu', 975000, 'Bình phun thuốc chạy pin 12V dung tích 16 lít, áp lực ổn định, phun liên tục 6–8 giờ mỗi lần sạc.', 'Bình 16 lít; ắc quy 12V – 8Ah; áp lực 0,15–0,6 MPa; lưu lượng 4,2 lít/phút; nặng khoảng 6 kg.', E'Không phải bơm tay, đỡ mỏi khi phun diện tích lớn.\nMột lần sạc phun được khoảng 20–25 bình.\nVan đồng chịu mài mòn và hóa chất; bảo hành 12 tháng.', E'Sạc đầy pin trước lần dùng đầu tiên.\nĐổ nước sạch đến 2/3 bình rồi mới cho thuốc, khuấy đều.\nRửa sạch bình, vòi và lọc sau mỗi lần phun; cất nơi khô ráo.', array['Lúa', 'Rau màu', 'Cây ăn trái', 'Cà phê']::text[], true),
  ('VT-PK-MANGPHU-2M2', 'Màng phủ nông nghiệp Phú Khang khổ 2,2 m', 'Phú Khang', 'cuộn', 'vat-tu', 1590000, 'Màng phủ luống hai mặt bạc – đen, giúp giữ ẩm, chống cỏ dại và hạn chế sâu bệnh cho rau màu, dưa, ớt.', 'Nhựa PE kèm phụ gia; mặt bạc phía trên, mặt đen phía dưới; cuộn dài khoảng 400 m (chưa đục lỗ).', E'Ngăn cỏ mọc trên luống, giảm công làm cỏ.\nGiữ ẩm mùa khô, chống xói luống mùa mưa.\nMặt bạc phản quang giúp xua côn trùng; dùng được 2–3 vụ nếu bảo quản tốt.', E'Lên luống, bón lót và tưới ẩm trước khi phủ.\nTrải mặt bạc lên trên, kéo căng và chèn đất hai mép.\nĐục lỗ theo khoảng cách trồng; hạn chế phun thuốc gốc đồng lên màng.', array['Dưa hấu', 'Ớt', 'Cà chua', 'Rau màu']::text[], false),
  ('VT-SF-DATRAU-20L', 'Đất trồng rau Sfarm', 'Sfarm', 'bao 20 lít', 'vat-tu', 72000, 'Đất sạch trộn sẵn cho rau trồng chậu, thùng xốp: tơi xốp, có phân hữu cơ và nấm Trichoderma.', 'Mùn, xơ dừa, phân trùn quế, phân bò, phân gà, bột lá neem, nấm Trichoderma và đất thịt; bao 20 dm³ (khoảng 8–9 kg).', E'Dùng ngay, không cần phối trộn thêm.\nTrichoderma giúp hạn chế nấm bệnh vùng rễ.\nGiữ ẩm tốt mà vẫn thoát nước, hợp trồng rau ban công.', E'Cho đất vào chậu, khay, cách miệng 3–5 cm.\nGieo hạt hoặc trồng cây con, tưới 1–2 lần/ngày.\nRau ngắn ngày không cần bón thêm; rau dài ngày bón bổ sung sau 25–30 ngày.', array['Rau màu', 'Hoa kiểng']::text[], false),
  ('VT-KHAYUOM-104', 'Khay ươm hạt 104 lỗ', 'Tân Tường Khang', 'cái', 'vat-tu', 10000, 'Khay nhựa 104 lỗ để ươm cây con và trồng rau mầm, dùng lại được nhiều lần.', 'Nhựa; kích thước 56 × 36 × 4 cm; ô 4 × 4 cm.', E'Cây con có bầu rễ riêng, ra ngôi không bị đứt rễ.\nTiết kiệm hạt giống và giá thể.\nRửa phơi khô là dùng lại được 4–5 lần.', E'Cho xơ dừa hoặc đất trộn phân vào từng ô, gieo 1 hạt/ô.\nTưới phun sương nhẹ, đặt nơi có nắng nhẹ, kê cao khỏi mặt đất.\nSau mỗi đợt, đổ bỏ giá thể cũ, rửa sạch và phơi khô khay.', array['Rau màu', 'Hoa kiểng']::text[], false)
) as v(sku, name, brand, unit, category, list_price, short_desc, composition, benefits, usage, crops, is_featured)
join public.categories c on c.slug = v.category;

insert into public.partner_tiers (name, kind) values
  ('CTV chuẩn', 'commission'),
  ('Đại lý cấp 1', 'wholesale');

insert into public.tier_rates (tier_id, category_id, rate_pct)
select t.id, c.id, v.rate_pct
from (values
  ('CTV chuẩn', 'npk', 3.00),
  ('CTV chuẩn', 'phan-don', 2.00),
  ('CTV chuẩn', 'huu-co', 5.00),
  ('CTV chuẩn', 'phan-bon-la', 8.00),
  ('CTV chuẩn', 'thuoc-bvtv', 6.00),
  ('CTV chuẩn', 'vat-tu', 4.00),
  ('Đại lý cấp 1', 'npk', 5.00),
  ('Đại lý cấp 1', 'phan-don', 4.00),
  ('Đại lý cấp 1', 'huu-co', 8.00),
  ('Đại lý cấp 1', 'phan-bon-la', 12.00),
  ('Đại lý cấp 1', 'thuoc-bvtv', 10.00),
  ('Đại lý cấp 1', 'vat-tu', 6.00)
) as v(tier, category, rate_pct)
join public.partner_tiers t on t.name = v.tier
join public.categories c on c.slug = v.category;

-- Một mức riêng theo sản phẩm (ghi đè mức theo nhóm) làm mẫu.
insert into public.tier_product_rates (tier_id, product_id, rate_pct)
select t.id, p.id, 10.00
from public.partner_tiers t, public.products p
where t.name = 'CTV chuẩn' and p.sku = 'LA-BACA-20-20-20-50G';

-- min_payout cũng được 0006 ghi; on conflict để chạy sau migrations không lỗi.
insert into public.settings (key, value) values
  ('store_name', to_jsonb('Cửa hàng vật tư'::text)),
  ('min_payout', to_jsonb(100000))
on conflict (key) do nothing;

insert into storage.buckets (id, name, public) values ('products', 'products', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payout-proofs', 'payout-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
commit;
