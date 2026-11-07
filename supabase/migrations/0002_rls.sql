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
  to anon, authenticated using (is_active or public.is_staff());

create policy promotions_read on public.promotions for select
  to anon, authenticated using (is_active or public.is_staff());

create policy settings_read on public.settings for select
  to anon, authenticated
  using (key in ('store_name', 'bank_info', 'zalo_link') or public.is_staff());

-- Đối tác (chỉ dữ liệu của mình; pending/locked không có current_partner_id) --

create policy partners_read on public.partners for select
  to authenticated using (user_id = auth.uid() or public.is_staff());

create policy partner_tiers_read on public.partner_tiers for select
  to authenticated using (id = public.current_tier_id() or public.is_staff());

create policy tier_rates_read on public.tier_rates for select
  to authenticated using (tier_id = public.current_tier_id() or public.is_staff());

create policy tier_product_rates_read on public.tier_product_rates for select
  to authenticated using (tier_id = public.current_tier_id() or public.is_staff());

create policy farmers_read on public.farmers for select
  to authenticated using (owner_partner_id = public.current_partner_id() or public.is_staff());

create policy orders_read on public.orders for select
  to authenticated using (partner_id = public.current_partner_id() or public.is_staff());

create policy order_lines_read on public.order_lines for select
  to authenticated using (
    public.is_staff()
    or order_id in (select id from public.orders where partner_id = public.current_partner_id())
  );

create policy commission_entries_read on public.commission_entries for select
  to authenticated using (partner_id = public.current_partner_id() or public.is_staff());

-- Nội bộ --------------------------------------------------------------------

create policy staff_read on public.staff for select
  to authenticated using (user_id = auth.uid() or public.is_staff());

create policy order_status_log_read on public.order_status_log for select
  to authenticated using (public.is_staff());

create policy farmer_transfer_log_read on public.farmer_transfer_log for select
  to authenticated using (public.is_staff());

create policy order_counters_read on public.order_counters for select
  to authenticated using (public.is_staff());
