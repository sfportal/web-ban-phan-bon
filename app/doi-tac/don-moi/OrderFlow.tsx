'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { Money } from '@/components/Money'
import type { CatalogProduct } from '@/lib/catalog/queries'
import { draftToLines, useOrderDraft, type OrderDraft } from '@/lib/draft/use-order-draft'
import type { FarmerSummary } from '@/lib/farmers/actions'
import { submitPartnerOrder } from '@/lib/orders/actions'
import type { Change, SubmitError } from '@/lib/orders/submit'
import { priceOrder, salePrice, type PromotionInput, type TierInput } from '@/lib/pricing'
import { ConfirmStep } from './ConfirmStep'
import { FarmerPicker } from './FarmerPicker'
import { ProductPicker } from './ProductPicker'

type Step = 'farmer' | 'products' | 'confirm'

const ERRORS: Record<SubmitError, string> = {
  empty_order: 'Đơn chưa có sản phẩm nào đặt được.',
  invalid_qty: 'Số lượng không hợp lệ. Vui lòng kiểm tra lại.',
  unavailable: 'Có sản phẩm đã hết hàng hoặc ngừng bán. Bấm "Sửa đơn" để kiểm tra lại.',
  invalid_phone: 'Số điện thoại không hợp lệ.',
  rate_limited: 'Bạn gửi quá nhanh. Vui lòng thử lại sau ít phút.',
  farmer_not_owned: 'Có nông dân không còn thuộc danh sách của bạn. Vui lòng bỏ nông dân đó rồi gửi lại.',
  missing_fields: 'Vui lòng nhập điểm giao hàng.',
}
const OFFLINE = 'Không gửi được đơn. Kiểm tra kết nối mạng rồi thử lại — đơn nháp vẫn được lưu trên máy.'

/** Luồng lên đơn của đối tác: (CTV) chọn nông dân → chọn sản phẩm → xác nhận. */
export function OrderFlow({
  partner,
  products,
  categories,
  promos,
  tier,
  frequent,
  initial,
  fromOrder,
}: {
  partner: { id: string; kind: 'commission' | 'wholesale'; deliveryAddress: string }
  products: CatalogProduct[]
  categories: { id: string; name: string }[]
  promos: PromotionInput[]
  tier: TierInput
  frequent: string[]
  initial?: OrderDraft
  fromOrder: boolean
}) {
  const router = useRouter()
  const { draft, addGroup, setQty, removeGroup, setDelivery, setNote, reset } = useOrderDraft(partner.id, initial)
  const isCtv = partner.kind === 'commission'
  const [step, setStep] = useState<Step | null>(null)
  const [active, setActive] = useState(0)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [changes, setChanges] = useState<Change[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  // "Đặt lại": đơn nháp đã nạp từ ?tu-don; bỏ tham số để tải lại trang không nạp lại.
  useEffect(() => {
    if (fromOrder) router.replace('/doi-tac/don-moi')
  }, [fromOrder, router])

  // Phía server draft luôn null (đơn nháp ở localStorage) nên mọi tính toán dưới đây chỉ chạy
  // trên trình duyệt; `now` dùng để hiển thị giá khuyến mãi đang hiệu lực.
  if (!draft) return <p className="py-8 text-center text-gray-600">Đang tải đơn nháp...</p>
  const now = new Date()

  const groups = draft.groups
  // CTV chưa có nông dân nào trong đơn thì luôn ở bước chọn nông dân.
  const current: Step = isCtv && groups.length === 0 ? 'farmer' : (step ?? 'products')
  const groupIdx = isCtv ? Math.min(active, groups.length - 1) : groups.length > 0 ? 0 : -1
  const group = groupIdx >= 0 ? groups[groupIdx] : undefined

  // Sản phẩm đặt được: còn trong catalog, còn hàng, và server chưa báo hết hàng / ngừng bán.
  const gone = new Set((changes ?? []).filter((c) => c.field !== 'price').map((c) => c.productId))
  const isOrderable = (id: string) => !gone.has(id) && !!byId.get(id)?.inStock
  const priceOf = (id: string) => salePrice(byId.get(id)!, promos, now).price
  const orderable: OrderDraft = {
    ...draft,
    groups: groups.map((g) => ({ ...g, items: g.items.filter((i) => isOrderable(i.productId)) })),
  }
  const lines = draftToLines(orderable, priceOf)
  const priced =
    lines.length > 0
      ? priceOrder(lines.map((l) => ({ product: byId.get(l.productId)!, qty: l.qty, farmerId: l.farmerId })), promos, tier, now)
      : null

  function go(s: Step) {
    setStep(s)
    setConfirmRemove(false)
    setChanges(null)
    setError(null)
    window.scrollTo({ top: 0 })
  }

  function pickFarmer(f: FarmerSummary) {
    setActive(addGroup({ id: f.id, name: f.name }))
    go('products')
  }

  function onQty(productId: string, qty: number) {
    // Đại lý: nhóm duy nhất (farmerId null) tạo khi thêm sản phẩm đầu tiên.
    if (isCtv && groupIdx < 0) return
    const idx = groupIdx >= 0 ? groupIdx : addGroup({ id: null, name: '' })
    setQty(idx, productId, qty)
  }

  function toConfirm() {
    if (!draft!.deliveryAddress.trim()) setDelivery(partner.deliveryAddress)
    go('confirm')
  }

  function submit(acceptChanges: boolean) {
    if (pending || !draft) return
    setError(null)
    const input = { clientKey: draft.clientKey, lines, deliveryAddress: draft.deliveryAddress, note: draft.note, acceptChanges }
    startTransition(async () => {
      try {
        const res = await submitPartnerOrder(input)
        if (res.status === 'ok') {
          reset()
          router.push(`/doi-tac/don-hang/${res.orderId}`)
        } else if (res.status === 'changed') {
          setChanges(res.changes)
          router.refresh() // tải lại giá / tồn kho mới từ server
        } else {
          setError(ERRORS[res.error])
        }
      } catch {
        setError(OFFLINE)
      }
    })
  }

  if (current === 'farmer') {
    return (
      <FarmerPicker
        chosenIds={groups.map((g) => g.farmerId)}
        onPick={pickFarmer}
        onCancel={groups.length > 0 ? () => go('products') : undefined}
      />
    )
  }

  if (current === 'confirm') {
    return (
      <ConfirmStep
        kind={partner.kind}
        draft={draft}
        byId={byId}
        isOrderable={isOrderable}
        priced={priced}
        changes={changes}
        error={error}
        pending={pending}
        onBack={() => go('products')}
        onSubmit={submit}
        onDelivery={setDelivery}
        onNote={setNote}
      />
    )
  }

  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const qtyOf = (id: string) => group?.items.find((i) => i.productId === id)?.qty ?? 0

  return (
    <section className="flex flex-col gap-4" aria-labelledby="products-step">
      <h1 id="products-step" className="text-2xl font-bold">Chọn sản phẩm</h1>

      {isCtv && group && (
        <div className="flex flex-col gap-2">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Nông dân trong đơn">
            {groups.map((g, i) => {
              const n = g.items.reduce((s, it) => s + it.qty, 0)
              return (
                <button key={g.farmerId} type="button" role="tab" aria-selected={i === groupIdx}
                  onClick={() => {
                    setActive(i)
                    setConfirmRemove(false)
                  }}
                  className={`h-11 shrink-0 rounded-full px-4 font-semibold ${i === groupIdx ? 'bg-green-700 text-white' : 'bg-gray-100'}`}>
                  {g.farmerName}{n > 0 ? ` (${n})` : ''}
                </button>
              )
            })}
            <button type="button" onClick={() => go('farmer')}
              className="h-11 shrink-0 rounded-full border-2 border-dashed border-green-700 px-4 font-semibold text-green-700">
              + Nông dân khác
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p>Đang chọn cho: <strong>{group.farmerName}</strong></p>
            {confirmRemove ? (
              <span className="flex gap-1">
                <button type="button" className="h-11 px-2 font-semibold text-red-700"
                  onClick={() => {
                    removeGroup(groupIdx)
                    setActive(0)
                    setConfirmRemove(false)
                  }}>
                  Bỏ khách này
                </button>
                <button type="button" className="h-11 px-2 font-semibold" onClick={() => setConfirmRemove(false)}>
                  Giữ
                </button>
              </span>
            ) : (
              <button type="button" className="h-11 px-2 text-red-700" onClick={() => setConfirmRemove(true)}>
                Bỏ khỏi đơn
              </button>
            )}
          </div>
        </div>
      )}

      <ProductPicker
        products={products}
        categories={categories}
        promos={promos}
        tier={tier}
        frequent={frequent}
        now={now}
        qtyOf={qtyOf}
        onQty={onQty}
      />

      <div className="fixed inset-x-0 bottom-0 border-t bg-white p-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm text-gray-600">{totalQty} sản phẩm{isCtv ? ` · ${groups.length} nông dân` : ''}</span>
            <Money value={priced?.subtotal ?? 0} className="text-lg font-bold" />
          </div>
          <button type="button" disabled={!priced} onClick={toConfirm}
            className="h-12 rounded-lg bg-green-700 px-6 text-lg font-semibold text-white disabled:opacity-50">
            Tiếp tục
          </button>
        </div>
      </div>
    </section>
  )
}
