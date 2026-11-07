import { Suspense } from 'react'
import { requirePartner, type PartnerSession } from '@/lib/auth/guards'
import { getCatalog, getTier } from '@/lib/catalog/queries'
import type { DraftGroup, OrderDraft } from '@/lib/draft/use-order-draft'
import { getFrequentProducts } from '@/lib/orders/frequent'
import { SITE_NAME } from '@/lib/site'
import { createServerClient } from '@/lib/supabase/server'
import { OrderFlow } from './OrderFlow'

export const metadata = { title: `Đơn mới — ${SITE_NAME}` }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * "Đặt lại" (?tu-don=<id>): đơn nháp mới chứa các dòng của đơn cũ (giá tính lại theo hiện
 * tại khi hiển thị/gửi). Chỉ nhận đơn của chính đối tác; id lạ / đơn của người khác → bỏ qua.
 * Dòng của nông dân không còn thuộc CTV và sản phẩm không còn bán bị bỏ.
 */
async function draftFromOrder(
  session: PartnerSession, orderId: string, activeIds: Set<string>,
): Promise<OrderDraft | undefined> {
  if (!UUID.test(orderId)) return undefined
  const { data: order } = await createServerClient()
    .from('orders')
    .select('id, partner_id, source, order_lines(product_id, qty, farmer_id, farmers(name, owner_partner_id))')
    .eq('id', orderId).eq('partner_id', session.partnerId).eq('source', 'partner')
    .maybeSingle().throwOnError()
  if (!order || order.partner_id !== session.partnerId) return undefined

  const groups: DraftGroup[] = []
  for (const l of order.order_lines) {
    if (!activeIds.has(l.product_id)) continue
    let farmerId: string | null = null
    let farmerName = ''
    if (session.kind === 'commission') {
      if (!l.farmer_id || l.farmers?.owner_partner_id !== session.partnerId) continue
      farmerId = l.farmer_id
      farmerName = l.farmers.name
    }
    let g = groups.find((x) => x.farmerId === farmerId)
    if (!g) groups.push((g = { farmerId, farmerName, items: [] }))
    const item = g.items.find((i) => i.productId === l.product_id)
    if (item) item.qty += l.qty
    else g.items.push({ productId: l.product_id, qty: l.qty })
  }
  if (groups.length === 0) return undefined
  return { clientKey: crypto.randomUUID(), groups, deliveryAddress: session.deliveryAddress, note: '' }
}

async function NewOrder({ searchParams }: Pick<PageProps<'/doi-tac/don-moi'>, 'searchParams'>) {
  const session = await requirePartner()
  const db = createServerClient()
  const [catalog, tier, frequent, params] = await Promise.all([
    getCatalog(db),
    getTier(db, session.tierId),
    getFrequentProducts(session.partnerId),
    searchParams,
  ])
  const from = params['tu-don']
  const initial =
    typeof from === 'string'
      ? await draftFromOrder(session, from, new Set(catalog.products.map((p) => p.id)))
      : undefined

  return (
    <OrderFlow
      partner={{ id: session.partnerId, kind: session.kind, deliveryAddress: session.deliveryAddress }}
      products={catalog.products}
      categories={catalog.categories}
      promos={catalog.promos}
      tier={tier}
      frequent={frequent}
      initial={initial}
      fromOrder={typeof from === 'string'}
    />
  )
}

export default function NewOrderPage({ searchParams }: PageProps<'/doi-tac/don-moi'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 pb-32 text-base">
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <NewOrder searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
