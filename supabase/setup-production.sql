-- Cài đặt CSDL cho Supabase bản thật: chạy MỘT LẦN trong SQL Editor của dự án mới (trống).
-- Gồm migrations 0001–0004, dữ liệu mẫu (nhóm, sản phẩm mẫu, bậc đối tác, tỷ lệ) và bucket ảnh 'products'.
-- Sản phẩm mẫu có thể sửa/ẩn trong trang Admin sau.
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

-- ===== supabase/seed.sql =====
-- Dữ liệu mẫu: nhóm, sản phẩm, 2 bậc đối tác kèm tỷ lệ theo nhóm (và 1 mức
-- riêng theo sản phẩm), tên cửa hàng.
-- Không tạo user (auth.users giữ nguyên qua db:reset).

insert into public.categories (name, sort_order) values
  ('Phân NPK', 1),
  ('Phân hữu cơ', 2),
  ('Phân bón lá', 3),
  ('Thuốc BVTV', 4),
  ('Vật tư', 5);

insert into public.products (sku, name, unit, category_id, list_price, description)
select v.sku, v.name, v.unit, c.id, v.list_price, v.description
from (values
  ('NPK-161616', 'Phân NPK 16-16-8 Đầu Trâu', 'bao 50kg', 'Phân NPK', 850000, 'Phân NPK cân đối cho lúa, cà phê, sầu riêng giai đoạn nuôi trái.'),
  ('NPK-201020', 'Phân NPK 20-10-20 Bình Điền', 'bao 50kg', 'Phân NPK', 920000, 'Giàu đạm và kali, dùng cho giai đoạn phát triển trái.'),
  ('NPK-301010', 'Phân NPK 30-10-10 Phú Mỹ', 'bao 25kg', 'Phân NPK', 480000, 'Đạm cao, kích thích ra lá, đâm chồi.'),
  ('HC-VISINH', 'Phân hữu cơ vi sinh Sông Gianh', 'bao 50kg', 'Phân hữu cơ', 350000, 'Cải tạo đất, tăng vi sinh vật có ích.'),
  ('HC-PHANBO', 'Phân bò ủ hoai', 'bao 25kg', 'Phân hữu cơ', 120000, 'Phân chuồng đã ủ hoai, không mùi.'),
  ('LA-ROONG', 'Phân bón lá Ra rễ cực mạnh', 'chai 500ml', 'Phân bón lá', 95000, 'Kích rễ, phục hồi cây sau thu hoạch.'),
  ('LA-DUONGTRAI', 'Phân bón lá Dưỡng trái to', 'gói 1kg', 'Phân bón lá', 145000, 'Bổ sung canxi-bo, chống rụng trái non.'),
  ('BVTV-NAM', 'Thuốc trừ nấm Anvil 5SC', 'chai 1 lít', 'Thuốc BVTV', 210000, 'Phòng trừ nấm hồng, thán thư, rỉ sắt.'),
  ('BVTV-SAU', 'Thuốc trừ sâu Regent 800WG', 'gói 100g', 'Thuốc BVTV', 65000, 'Trừ sâu đục thân, rầy, bọ trĩ.'),
  ('VT-BINHXIT', 'Bình xịt điện 20 lít', 'cái', 'Vật tư', 780000, 'Bình phun thuốc chạy pin, 2 chế độ phun.')
) as v(sku, name, unit, category, list_price, description)
join public.categories c on c.name = v.category;

insert into public.partner_tiers (name, kind) values
  ('CTV chuẩn', 'commission'),
  ('Đại lý cấp 1', 'wholesale');

insert into public.tier_rates (tier_id, category_id, rate_pct)
select t.id, c.id, v.rate_pct
from (values
  ('CTV chuẩn', 'Phân NPK', 3.00),
  ('CTV chuẩn', 'Phân hữu cơ', 5.00),
  ('CTV chuẩn', 'Phân bón lá', 8.00),
  ('CTV chuẩn', 'Thuốc BVTV', 6.00),
  ('CTV chuẩn', 'Vật tư', 4.00),
  ('Đại lý cấp 1', 'Phân NPK', 5.00),
  ('Đại lý cấp 1', 'Phân hữu cơ', 8.00),
  ('Đại lý cấp 1', 'Phân bón lá', 12.00),
  ('Đại lý cấp 1', 'Thuốc BVTV', 10.00),
  ('Đại lý cấp 1', 'Vật tư', 6.00)
) as v(tier, category, rate_pct)
join public.partner_tiers t on t.name = v.tier
join public.categories c on c.name = v.category;

-- Một mức riêng theo sản phẩm (ghi đè mức theo nhóm) làm mẫu.
insert into public.tier_product_rates (tier_id, product_id, rate_pct)
select t.id, p.id, 10.00
from public.partner_tiers t, public.products p
where t.name = 'CTV chuẩn' and p.sku = 'LA-DUONGTRAI';

insert into public.settings (key, value) values
  ('store_name', to_jsonb('Cửa hàng vật tư'::text));

insert into storage.buckets (id, name, public) values ('products', 'products', true) on conflict (id) do nothing;
commit;
