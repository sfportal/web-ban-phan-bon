'use server'
// Server Actions xử lý đơn của nhân viên: đổi trạng thái (từng đơn / hàng loạt), sửa đơn,
// số liệu tổng quan, xuất Excel cho kế toán. Mỗi action tự gọi requireStaff().
import { z } from 'zod'
import { requireStaff } from '@/lib/auth/guards'
import { buildOrdersWorkbook } from '@/lib/excel/export'
import { vnDateStart, vnDayStart, vnPeriod } from '@/lib/format'
import type { EditResult } from '@/lib/orders/edit'
import type { OrderStatus } from '@/lib/orders/status'
import { farmersAllowed, linesPayload, parseSeenLines, priceAndDiff, type SeenLine } from '@/lib/orders/submit'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'

const uuid = z.guid()
const statusSchema = z.enum(['new', 'confirmed', 'shipping', 'delivered', 'paid', 'cancelled', 'returned'])
const MAX_BULK = 500

export type StatusResult = { ok: true } | { error: 'invalid_transition' | 'not_found' }

async function changeStatus(userId: string, orderId: unknown, to: unknown, note: unknown): Promise<StatusResult> {
  if (!uuid.safeParse(orderId).success) return { error: 'not_found' }
  const target = statusSchema.safeParse(to)
  if (!target.success) return { error: 'invalid_transition' }
  const text = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null
  const { error } = await adminClient().rpc('change_order_status', {
    p_order_id: orderId as string, p_to: target.data, p_actor: userId, p_actor_kind: 'staff', p_note: text,
  })
  if (!error) return { ok: true }
  if (error.message === 'invalid_transition') return { error: 'invalid_transition' }
  if (error.message === 'order_not_found') return { error: 'not_found' }
  throw error
}

/** Đổi trạng thái một đơn theo sơ đồ (server kiểm tra trong change_order_status). */
export async function setOrderStatus(orderId: string, to: OrderStatus, note?: string): Promise<StatusResult> {
  const { userId } = await requireStaff()
  return changeStatus(userId, orderId, to, note)
}

/** Đổi trạng thái lần lượt từng đơn; đơn lỗi không ảnh hưởng đơn khác. */
export async function bulkSetStatus(
  ids: string[], to: OrderStatus,
): Promise<{ ok: string[]; failed: { id: string; code: string }[] }> {
  const { userId } = await requireStaff()
  if (!Array.isArray(ids) || ids.length > MAX_BULK) throw new Error(`Tối đa ${MAX_BULK} đơn mỗi lần`)
  const ok: string[] = []
  const failed: { id: string; code: string }[] = []
  for (const id of [...new Set(ids)]) {
    try {
      const res = await changeStatus(userId, id, to, null)
      if ('ok' in res) ok.push(id)
      else failed.push({ id: String(id), code: res.error })
    } catch (e) {
      // Lỗi bất ngờ (mạng/DB) của một đơn không được làm dừng các đơn còn lại.
      console.error('bulkSetStatus: lỗi đổi trạng thái đơn', id, e)
      failed.push({ id: String(id), code: 'error' })
    }
  }
  return { ok, failed }
}

// Sửa đơn ---------------------------------------------------------------------------

function isNotEditable(message: string): boolean {
  return ['not_editable', 'order_not_found'].includes(message)
}

/**
 * Nhân viên thay toàn bộ dòng hàng của đơn `new` | `confirmed`. Tính lại như editMyOrder
 * (priceAndDiff) theo bậc của đối tác của ĐƠN (đơn lẻ không gắn CTV → giá lẻ). Nông dân:
 * đơn CTV → đã có trong đơn hoặc đang thuộc CTV đó; đơn đại lý → không gắn; đơn lẻ → giữ
 * nông dân sẵn có của đơn.
 */
export async function staffEditOrder(orderId: string, lines: SeenLine[], acceptChanges: boolean): Promise<EditResult> {
  const { userId } = await requireStaff()
  if (!uuid.safeParse(orderId).success) return { status: 'error', error: 'not_editable' }
  const db = adminClient()
  const { data: order } = await db
    .from('orders').select('id, code, status, source, partner_id, partners(tier_id, partner_tiers(kind))')
    .eq('id', orderId).maybeSingle().throwOnError()
  if (!order || (order.status !== 'new' && order.status !== 'confirmed')) return { status: 'error', error: 'not_editable' }

  const parsed = parseSeenLines(lines)
  if (!parsed || typeof acceptChanges !== 'boolean') return { status: 'error', error: 'missing_fields' }

  const tierId = order.partners?.tier_id ?? null
  const kind = order.partners?.partner_tiers?.kind ?? null
  let pricingTier: string | null
  if (order.source === 'partner') {
    if (!order.partner_id || !tierId || !kind) return { status: 'error', error: 'not_editable' }
    let allowed: boolean
    if (kind === 'wholesale') {
      allowed = await farmersAllowed({ kind, partnerId: order.partner_id }, parsed)
    } else {
      // Chuyển nông dân không ảnh hưởng đơn cũ: nông dân đã có trong đơn vẫn giữ được;
      // nông dân mới thêm vào phải đang thuộc CTV của đơn.
      const { data: current } = await db.from('order_lines').select('farmer_id').eq('order_id', order.id).throwOnError()
      const inOrder = new Set(current.map((l) => l.farmer_id).filter((f) => f !== null))
      allowed = parsed.every((l) => l.farmerId !== null)
        && await farmersAllowed({ kind, partnerId: order.partner_id }, parsed.filter((l) => !(l.farmerId && inOrder.has(l.farmerId))))
    }
    if (!allowed) return { status: 'error', error: 'farmer_not_owned' }
    pricingTier = tierId
  } else {
    // Mỗi dòng giữ nông dân của chính dòng đó trong đơn (khớp theo sản phẩm).
    const { data: current } = await db.from('order_lines').select('product_id, farmer_id').eq('order_id', order.id).throwOnError()
    const farmersOf = new Map<string, Set<string | null>>()
    for (const l of current) farmersOf.set(l.product_id, (farmersOf.get(l.product_id) ?? new Set()).add(l.farmer_id))
    if (parsed.some((l) => !farmersOf.get(l.productId)?.has(l.farmerId))) return { status: 'error', error: 'farmer_not_owned' }
    // Như submitRetailOrder: khách của CTV tính hoa hồng theo bậc CTV; đại lý không có hoa hồng đơn lẻ.
    pricingTier = kind === 'commission' ? tierId : null
  }

  const result = await priceAndDiff({ lines: parsed, tierId: pricingTier, acceptChanges })
  if (result.status !== 'ok') return result
  const { priced } = result

  const { error } = await db.rpc('replace_order_lines', {
    p_order_id: order.id,
    p_lines: linesPayload(priced),
    p_totals: {
      subtotal: priced.subtotal,
      partner_payable: priced.partnerPayable,
      commission_expected: priced.commissionExpected,
    },
    p_actor: userId,
    p_actor_kind: 'staff',
  })
  if (error) {
    if (isNotEditable(error.message)) return { status: 'error', error: 'not_editable' }
    throw error
  }
  return { status: 'ok', orderId: order.id, code: order.code }
}

// Tổng quan -------------------------------------------------------------------------

export type DashboardStats = {
  /** Đơn tạo từ 0h hôm nay (giờ VN). */
  newToday: number
  /** Đơn `delivered` chưa thu tiền. */
  awaitingPayment: number
  /**
   * Tiền thu được của các đơn chuyển `paid` trong tháng này (giờ VN), bỏ đơn sau đó đã trả hàng:
   * đơn đại lý tính `partner_payable`, đơn khác tính `subtotal`.
   */
  monthRevenue: number
  /** Tổng hoa hồng `pending` (đã trừ dòng âm do trả hàng). */
  pendingCommission: number
}

export async function dashboardStats(): Promise<DashboardStats> {
  await requireStaff()
  const db = adminClient()
  const now = new Date()
  const monthStart = vnDateStart(`${vnPeriod(now)}-01`)!.toISOString()
  const [today, delivered, paidLog, pending] = await Promise.all([
    db.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', vnDayStart(0, now).toISOString()).throwOnError(),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'delivered').throwOnError(),
    fetchAll((from, to) =>
      db.from('order_status_log').select('id, order_id, orders(subtotal, partner_payable, status)')
        .eq('to_status', 'paid').gte('changed_at', monthStart).order('id').range(from, to).throwOnError()),
    fetchAll((from, to) =>
      db.from('commission_entries').select('id, amount').eq('status', 'pending').order('id').range(from, to).throwOnError()),
  ])
  const seen = new Set<string>()
  let monthRevenue = 0
  for (const e of paidLog) {
    if (seen.has(e.order_id) || !e.orders || e.orders.status === 'returned') continue
    seen.add(e.order_id)
    monthRevenue += Number(e.orders.partner_payable ?? e.orders.subtotal)
  }
  return {
    newToday: today.count ?? 0,
    awaitingPayment: delivered.count ?? 0,
    monthRevenue,
    pendingCommission: pending.reduce((s, e) => s + Number(e.amount), 0),
  }
}

// Xuất Excel cho kế toán -------------------------------------------------------------

const MAX_RANGE_DAYS = 366

/** Mỗi dòng đơn một hàng, đơn tạo trong [from, to). Nhân viên (kế toán) được xuất. */
export async function exportOrders(from: Date, to: Date): Promise<Buffer> {
  await requireStaff()
  if (!(from instanceof Date) || !(to instanceof Date) || Number.isNaN(+from) || Number.isNaN(+to) || to <= from) {
    throw new Error('Khoảng ngày không hợp lệ')
  }
  if (+to - +from > MAX_RANGE_DAYS * 86400_000) throw new Error(`Tối đa ${MAX_RANGE_DAYS} ngày mỗi lần xuất`)
  const db = adminClient()
  const lines = await fetchAll((f, t) =>
    db.from('order_lines')
      .select(`id, qty, sale_price_snap, line_total, rate_pct_snap, line_commission, line_partner_price,
        farmers(name, phone), products(name),
        orders!inner(code, created_at, source, status, retail_name, retail_phone, partners(name))`)
      .gte('orders.created_at', from.toISOString()).lt('orders.created_at', to.toISOString())
      .order('id').range(f, t).throwOnError())
  lines.sort((a, b) =>
    a.orders.created_at.localeCompare(b.orders.created_at) || a.orders.code.localeCompare(b.orders.code)
    || (a.farmers?.name ?? '').localeCompare(b.farmers?.name ?? '', 'vi') || a.id.localeCompare(b.id))
  return buildOrdersWorkbook(lines.map((l) => ({
    code: l.orders.code,
    createdAt: l.orders.created_at,
    source: l.orders.source,
    partnerName: l.orders.partners?.name ?? null,
    farmerName: l.farmers?.name ?? l.orders.retail_name,
    phone: l.farmers?.phone ?? l.orders.retail_phone,
    productName: l.products?.name ?? '',
    qty: l.qty,
    salePrice: Number(l.sale_price_snap),
    lineTotal: Number(l.line_total),
    ratePct: Number(l.rate_pct_snap),
    commission: Number(l.line_commission),
    partnerPrice: l.line_partner_price === null ? null : Number(l.line_partner_price),
    status: l.orders.status,
  })))
}
