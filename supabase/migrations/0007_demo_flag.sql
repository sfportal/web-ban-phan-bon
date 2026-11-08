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
