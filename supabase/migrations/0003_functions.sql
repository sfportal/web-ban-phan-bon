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
