-- Dữ liệu đặt thử: create_order nhận thêm khóa p_order->>'is_demo' (mặc định false) để đánh dấu
-- đơn thử. Giữ nguyên chữ ký (jsonb, jsonb) nên quyền execute của 0003 còn hiệu lực; ghi lại
-- revoke/grant tường minh cho chắc. Không đổi logic tạo đơn khác.

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
    commission_expected, total_qty, is_demo
  ) values (
    v_code, v_key, p_order->>'client_ip', p_order->>'source',
    nullif(p_order->>'partner_id', '')::uuid, p_order->>'delivery_address',
    coalesce(p_order->>'payment_method', 'cod'),
    p_order->>'retail_name', p_order->>'retail_phone', p_order->>'retail_address', p_order->>'note',
    coalesce((p_order->>'subtotal')::bigint, 0), (p_order->>'partner_payable')::bigint,
    coalesce((p_order->>'commission_expected')::bigint, 0),
    coalesce((select sum((l->>'qty')::int) from jsonb_array_elements(p_lines) l), 0),
    coalesce((p_order->>'is_demo')::boolean, false)
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

revoke all on function public.create_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb) to service_role;
