import 'server-only'
// Đường gửi đơn (tiền): server tải lại sản phẩm/khuyến mãi/bậc, tính bằng priceOrder,
// so với giá trình duyệt đã thấy, rồi gọi RPC create_order (idempotent theo client_key).
// Không có 'use server' ở đây: Server Action công khai là lib/orders/actions.ts (gửi đơn)
// và lib/orders/edit.ts (sửa/hủy), để priceAndDiff và các hàm dùng chung không bị lộ thành endpoint.
import { headers } from 'next/headers'
import { after } from 'next/server'
import { z } from 'zod'
import { requirePartner, type PartnerSession } from '@/lib/auth/guards'
import { getActivePromos, getProductsByIds, getTier } from '@/lib/catalog/queries'
import { notifyNewOrder } from '@/lib/notify'
import { normalizePhone } from '@/lib/phone'
import { PricingError, priceOrder, type PricedOrder } from '@/lib/pricing'
import { adminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'

export type SeenLine = { productId: string; qty: number; farmerId: string | null; seenSalePrice: number }

/**
 * Một thay đổi so với lúc trình duyệt hiển thị:
 * - `price`: old = giá đã thấy, new = giá bán hiện tại của server.
 * - `stock`: old = true (còn hàng), new = false (hết hàng).
 * - `inactive`: old = false, new = true (sản phẩm bị ẩn hoặc không tồn tại).
 */
export type Change = {
  productId: string
  field: 'price' | 'stock' | 'inactive'
  old: number | boolean
  new: number | boolean
}

export type SubmitError =
  | 'empty_order'
  | 'invalid_qty'
  | 'unavailable'
  | 'invalid_phone'
  | 'rate_limited'
  | 'farmer_not_owned'
  | 'missing_fields'

export type SubmitResult =
  | { status: 'ok'; orderId: string; code: string }
  | { status: 'changed'; changes: Change[] }
  | { status: 'error'; error: SubmitError }

export type PriceAndDiffResult =
  | { status: 'ok'; priced: PricedOrder }
  | { status: 'changed'; changes: Change[] }
  | { status: 'error'; error: 'empty_order' | 'invalid_qty' | 'unavailable' }

export const MAX_LINE_QTY = 9999
const MAX_LINES = 200
const RETAIL_LIMIT_PER_10_MIN = 3

/**
 * Tính lại đơn theo dữ liệu DB hiện tại (service role, thấy cả sản phẩm bị ẩn).
 * - Có dòng hết hàng/ẩn/không tồn tại: `changed` (kèm mọi thay đổi giá), hoặc
 *   `error: 'unavailable'` nếu `acceptChanges`.
 * - Chỉ khác giá: `changed` nếu `!acceptChanges`, ngược lại tính theo giá server.
 * - `tierId` null → giá bán lẻ, không hoa hồng. Kiểm tra quyền/nông dân là việc của bên gọi.
 */
export async function priceAndDiff(input: {
  lines: SeenLine[]
  tierId: string | null
  acceptChanges: boolean
  now?: Date
}): Promise<PriceAndDiffResult> {
  const { lines, tierId, acceptChanges } = input
  if (lines.length === 0) return { status: 'error', error: 'empty_order' }
  if (lines.some((l) => !Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_LINE_QTY)) {
    return { status: 'error', error: 'invalid_qty' }
  }

  const db = adminClient()
  const ids = [...new Set(lines.map((l) => l.productId))]
  const [products, promos, tier] = await Promise.all([
    getProductsByIds(db, ids),
    getActivePromos(db),
    tierId ? getTier(db, tierId) : Promise.resolve(null),
  ])
  const byId = new Map(products.map((p) => [p.id, p]))

  const unavailable: Change[] = []
  const flagged = new Set<string>()
  for (const { productId } of lines) {
    if (flagged.has(productId)) continue
    const p = byId.get(productId)
    if (!p || !p.isActive) unavailable.push({ productId, field: 'inactive', old: false, new: true })
    else if (!p.inStock) unavailable.push({ productId, field: 'stock', old: true, new: false })
    else continue
    flagged.add(productId)
  }
  if (unavailable.length > 0 && acceptChanges) return { status: 'error', error: 'unavailable' }

  // Dòng còn bán: tính giá server để so với giá đã thấy.
  const sellable = lines.filter((l) => !flagged.has(l.productId))
  let priced: PricedOrder | null = null
  if (sellable.length > 0) {
    try {
      priced = priceOrder(
        sellable.map((l) => ({ product: byId.get(l.productId)!, qty: l.qty, farmerId: l.farmerId })),
        promos, tier, input.now ?? new Date(),
      )
    } catch (e) {
      if (e instanceof PricingError) return { status: 'error', error: e.message as 'empty_order' | 'invalid_qty' }
      throw e
    }
  }

  const priceChanges: Change[] = []
  const seenPrice = new Set<string>()
  priced?.lines.forEach((pl, i) => {
    const seen = sellable[i].seenSalePrice
    const key = `${pl.productId}:${seen}`
    if (seen !== pl.salePriceSnap && !seenPrice.has(key)) {
      seenPrice.add(key)
      priceChanges.push({ productId: pl.productId, field: 'price', old: seen, new: pl.salePriceSnap })
    }
  })

  // Giữ thứ tự dòng như trình duyệt gửi.
  const order = new Map(ids.map((id, i) => [id, i]))
  const changes = [...priceChanges, ...unavailable].sort(
    (a, b) => order.get(a.productId)! - order.get(b.productId)!,
  )
  if (unavailable.length > 0 || (priceChanges.length > 0 && !acceptChanges)) return { status: 'changed', changes }
  return { status: 'ok', priced: priced! }
}

// Kiểm tra dữ liệu vào -------------------------------------------------------------

const id = z.guid()
const seenLine = z.object({
  productId: id,
  qty: z.number(),
  farmerId: id.nullable(),
  seenSalePrice: z.number(),
})
const optionalNote = z.string().max(1000).optional()

const partnerInput = z.object({
  clientKey: id,
  lines: z.array(seenLine).max(MAX_LINES),
  deliveryAddress: z.string().max(500),
  note: optionalNote,
  acceptChanges: z.boolean(),
})

const retailInput = z.object({
  clientKey: id,
  lines: z.array(seenLine.omit({ farmerId: true })).max(MAX_LINES),
  name: z.string().max(200),
  phone: z.string().max(30),
  address: z.string().max(500),
  paymentMethod: z.enum(['cod', 'transfer']),
  note: optionalNote,
  honeypot: z.string().optional(),
  /** Khách đã thấy thay đổi giá và bấm "Đồng ý và gửi lại". */
  acceptChanges: z.boolean().optional(),
})

/** Kiểm tra mảng dòng hàng trình duyệt gửi (dùng cho sửa đơn); sai dạng → null. */
export function parseSeenLines(raw: unknown): SeenLine[] | null {
  const parsed = z.array(seenLine).max(MAX_LINES).safeParse(raw)
  return parsed.success ? parsed.data : null
}

export type PartnerOrderInput = z.input<typeof partnerInput>
export type RetailOrderInput = z.input<typeof retailInput>

const fail = (error: SubmitError): SubmitResult => ({ status: 'error', error })
const blankToNull = (s: string | undefined) => (s?.trim() ? s.trim() : null)

/** Đơn đã có cùng client_key (lần gửi lại). `owns` quyết định có trả về cho người gọi không. */
async function existingOrder(clientKey: string) {
  const { data } = await adminClient()
    .from('orders').select('id, code, source, partner_id, retail_phone').eq('client_key', clientKey)
    .maybeSingle().throwOnError()
  return data
}

/** p_lines cho create_order / replace_order_lines (khóa = tên cột order_lines). */
export function linesPayload(priced: PricedOrder): Json {
  return priced.lines.map((l) => ({
    farmer_id: l.farmerId,
    product_id: l.productId,
    qty: l.qty,
    list_price_snap: l.listPriceSnap,
    sale_price_snap: l.salePriceSnap,
    promotion_id_snap: l.promotionIdSnap,
    rate_pct_snap: l.ratePctSnap,
    line_total: l.lineTotal,
    line_commission: l.lineCommission,
    line_partner_price: l.linePartnerPrice,
  }))
}

async function createOrder(order: Record<string, Json | undefined>, priced: PricedOrder) {
  const { data } = await adminClient()
    .rpc('create_order', {
      p_order: {
        ...order,
        subtotal: priced.subtotal,
        partner_payable: priced.partnerPayable,
        commission_expected: priced.commissionExpected,
      },
      p_lines: linesPayload(priced),
    })
    .throwOnError()
  return data[0]
}

async function clientIp(): Promise<string | null> {
  const first = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim()
  return first ? first.slice(0, 64) : null
}

// Đơn đối tác (CTV / đại lý) --------------------------------------------------------

/** Đại lý mua cho chính mình: không gắn nông dân. CTV: mọi dòng phải là nông dân của mình. */
export async function farmersAllowed(
  session: Pick<PartnerSession, 'kind' | 'partnerId'>, lines: Pick<SeenLine, 'farmerId'>[],
): Promise<boolean> {
  const farmerIds = lines.map((l) => l.farmerId)
  if (session.kind === 'wholesale') return farmerIds.every((f) => f === null)
  if (farmerIds.length === 0) return true
  if (farmerIds.some((f) => f === null)) return false
  const unique = [...new Set(farmerIds as string[])]
  const { data: owned } = await adminClient()
    .from('farmers').select('id').in('id', unique).eq('owner_partner_id', session.partnerId).throwOnError()
  return owned.length === unique.length
}

export async function submitPartnerOrder(raw: PartnerOrderInput): Promise<SubmitResult> {
  const session = await requirePartner()
  const parsed = partnerInput.safeParse(raw)
  if (!parsed.success) return fail('missing_fields')
  const input = parsed.data
  const deliveryAddress = input.deliveryAddress.trim()
  if (!deliveryAddress) return fail('missing_fields')

  const prior = await existingOrder(input.clientKey)
  if (prior) {
    return prior.source === 'partner' && prior.partner_id === session.partnerId
      ? { status: 'ok', orderId: prior.id, code: prior.code }
      : fail('missing_fields')
  }

  if (!(await farmersAllowed(session, input.lines))) return fail('farmer_not_owned')

  const result = await priceAndDiff({ lines: input.lines, tierId: session.tierId, acceptChanges: input.acceptChanges })
  if (result.status !== 'ok') return result

  const created = await createOrder(
    {
      source: 'partner',
      partner_id: session.partnerId,
      client_key: input.clientKey,
      client_ip: await clientIp(),
      delivery_address: deliveryAddress,
      payment_method: 'cod',
      note: blankToNull(input.note),
      actor: session.userId,
    },
    result.priced,
  )
  const notice = {
    code: created.code, source: 'partner' as const, partnerName: session.name,
    subtotal: result.priced.subtotal, partnerPayable: result.priced.partnerPayable,
  }
  after(() => notifyNewOrder(notice))
  return { status: 'ok', orderId: created.id, code: created.code }
}

// Đơn lẻ (khách vãng lai) -----------------------------------------------------------

/** Nông dân theo SĐT; chưa có thì tạo không chủ. Trả kèm chủ (CTV) nếu có. */
async function ensureFarmer(phone: string, name: string, address: string) {
  const db = adminClient()
  await db
    .from('farmers')
    .upsert({ phone, name, address, owner_partner_id: null }, { onConflict: 'phone', ignoreDuplicates: true })
    .throwOnError()
  const { data } = await db
    .from('farmers')
    .select('id, owner_partner_id, partners(name, tier_id, partner_tiers(kind))')
    .eq('phone', phone).single().throwOnError()
  return data
}

export async function submitRetailOrder(raw: RetailOrderInput): Promise<SubmitResult> {
  // Bot điền ô ẩn: giả như thành công, không tạo gì.
  const honeypot = (raw as { honeypot?: unknown } | null)?.honeypot
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { status: 'ok', orderId: crypto.randomUUID(), code: 'DH0000-0000' }
  }

  const parsed = retailInput.safeParse(raw)
  if (!parsed.success) return fail('missing_fields')
  const input = parsed.data
  const name = input.name.trim()
  const address = input.address.trim()
  if (!name || !address || !input.phone.trim()) return fail('missing_fields')
  const phone = normalizePhone(input.phone)
  if (!phone) return fail('invalid_phone')

  const prior = await existingOrder(input.clientKey)
  if (prior) {
    return prior.source === 'retail' && prior.retail_phone === phone
      ? { status: 'ok', orderId: prior.id, code: prior.code }
      : fail('missing_fields')
  }

  if (input.lines.length === 0) return fail('empty_order')
  const ip = await clientIp()
  const { data: recent } = await adminClient()
    .rpc('retail_recent_count', { p_phone: phone, p_ip: ip ?? '' }).throwOnError()
  if (recent >= RETAIL_LIMIT_PER_10_MIN) return fail('rate_limited')

  const farmer = await ensureFarmer(phone, name, address)
  const owner = farmer.owner_partner_id ? farmer.partners : null
  // Khách của CTV: tính hoa hồng theo bậc của CTV đó (đại lý không có hoa hồng đơn lẻ).
  const tierId = owner?.tier_id && owner.partner_tiers?.kind === 'commission' ? owner.tier_id : null

  const result = await priceAndDiff({
    lines: input.lines.map((l) => ({ ...l, farmerId: farmer.id })),
    tierId,
    acceptChanges: input.acceptChanges ?? false,
  })
  if (result.status !== 'ok') return result

  const created = await createOrder(
    {
      source: 'retail',
      partner_id: farmer.owner_partner_id,
      client_key: input.clientKey,
      client_ip: ip,
      payment_method: input.paymentMethod,
      retail_name: name,
      retail_phone: phone,
      retail_address: address,
      note: blankToNull(input.note),
    },
    result.priced,
  )
  const notice = {
    code: created.code, source: 'retail' as const, partnerName: owner?.name ?? null,
    subtotal: result.priced.subtotal, partnerPayable: result.priced.partnerPayable,
  }
  after(() => notifyNewOrder(notice))
  return { status: 'ok', orderId: created.id, code: created.code }
}
