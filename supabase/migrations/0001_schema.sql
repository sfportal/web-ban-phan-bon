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
