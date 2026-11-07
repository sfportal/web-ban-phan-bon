import 'server-only'
// "Hay đặt": sản phẩm đối tác đặt nhiều nhất. Hàm server thường (không phải Server Action):
// chỉ gọi từ trang với partnerId lấy từ requirePartner().
import { adminClient } from '@/lib/supabase/admin'

const TOP = 10
const PAGE = 1000

/** Top 10 product_id theo tổng qty trên mọi đơn của đối tác (mọi thời gian), bỏ đơn đã hủy. */
export async function getFrequentProducts(partnerId: string): Promise<string[]> {
  const totals = new Map<string, number>()
  for (let from = 0; ; from += PAGE) {
    const { data } = await adminClient()
      .from('order_lines')
      .select('id, product_id, qty, orders!inner(partner_id, status)')
      .eq('orders.partner_id', partnerId)
      .neq('orders.status', 'cancelled')
      .order('id')
      .range(from, from + PAGE - 1)
      .throwOnError()
    for (const l of data) totals.set(l.product_id, (totals.get(l.product_id) ?? 0) + l.qty)
    if (data.length < PAGE) break
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP)
    .map(([id]) => id)
}
