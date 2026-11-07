'use client'

import { Money } from '@/components/Money'
import type { CatalogProduct } from '@/lib/catalog/queries'
import type { OrderDraft } from '@/lib/draft/use-order-draft'
import { formatVnd } from '@/lib/format'
import type { Change } from '@/lib/orders/submit'
import type { PricedOrder } from '@/lib/pricing'

const field = 'w-full rounded-lg border border-gray-300 px-3 text-base'
const labelCls = 'flex flex-col gap-1 font-semibold'

function changeText(c: Change): string {
  if (c.field === 'price') return `Giá đổi: ${formatVnd(Number(c.old))} → ${formatVnd(Number(c.new))}`
  if (c.field === 'stock') return 'Đã hết hàng — bỏ khỏi đơn'
  return 'Ngừng bán — bỏ khỏi đơn'
}

/**
 * Bước 3: xác nhận. `priced` là bản tính tạm phía trình duyệt (priceOrder) cho các dòng
 * đặt được, theo thứ tự `draftToLines`; server tính lại khi gửi.
 */
export function ConfirmStep({
  kind,
  draft,
  byId,
  isOrderable,
  priced,
  changes,
  error,
  pending,
  onBack,
  onSubmit,
  onDelivery,
  onNote,
}: {
  kind: 'commission' | 'wholesale'
  draft: OrderDraft
  byId: Map<string, CatalogProduct>
  isOrderable: (productId: string) => boolean
  priced: PricedOrder | null
  changes: Change[] | null
  error: string | null
  pending: boolean
  onBack: () => void
  onSubmit: (acceptChanges: boolean) => void
  onDelivery: (s: string) => void
  onNote: (s: string) => void
}) {
  const changeOf = new Map((changes ?? []).map((c) => [c.productId, c]))
  // Dòng giá theo (farmerId, productId) — mỗi nhóm một nông dân, mỗi sản phẩm một dòng.
  const lineOf = new Map(priced?.lines.map((l) => [`${l.farmerId}:${l.productId}`, l]) ?? [])
  const groups = draft.groups.filter((g) => g.items.length > 0)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="confirm-step">
      <div className="flex items-center justify-between gap-2">
        <h1 id="confirm-step" className="text-2xl font-bold">Xác nhận đơn</h1>
        <button type="button" onClick={onBack} className="h-11 px-2 font-semibold text-green-700">
          Sửa đơn
        </button>
      </div>

      {groups.map((g) => {
        const total = g.items.reduce((s, i) => s + (lineOf.get(`${g.farmerId}:${i.productId}`)?.lineTotal ?? 0), 0)
        return (
          <div key={g.farmerId ?? 'self'} className="flex flex-col rounded-xl border border-gray-200">
            {kind === 'commission' && <h2 className="border-b px-3 py-2 text-lg font-semibold">{g.farmerName}</h2>}
            <ul className="flex flex-col divide-y">
              {g.items.map((i) => {
                const p = byId.get(i.productId)
                const line = lineOf.get(`${g.farmerId}:${i.productId}`)
                const change = changeOf.get(i.productId)
                return (
                  <li key={i.productId} className={`flex flex-col gap-1 px-3 py-2 ${change ? 'bg-amber-100' : ''}`}>
                    <span className="font-semibold">{p?.name ?? 'Sản phẩm không còn bán'}</span>
                    {line && isOrderable(i.productId) ? (
                      <span className="flex flex-wrap justify-between gap-x-2">
                        <span>
                          {i.qty} × <Money value={line.salePriceSnap} />
                        </span>
                        <Money value={line.lineTotal} className="font-semibold" />
                      </span>
                    ) : (
                      !change && <span className="font-semibold text-red-700">Không đặt được — bỏ khỏi đơn</span>
                    )}
                    {change && <span className="font-semibold text-amber-900">{changeText(change)}</span>}
                  </li>
                )
              })}
            </ul>
            {kind === 'commission' && (
              <p className="flex justify-between border-t px-3 py-2">
                <span>Tổng {g.farmerName}</span>
                <Money value={total} className="font-semibold" />
              </p>
            )}
          </div>
        )
      })}

      {priced && (
        <dl className="flex flex-col gap-1 rounded-xl bg-gray-50 p-3">
          {kind === 'commission' ? (
            <>
              <div className="flex justify-between text-lg font-bold">
                <dt>Tổng đơn</dt>
                <dd><Money value={priced.subtotal} /></dd>
              </div>
              <div className="flex justify-between text-green-700">
                <dt>Hoa hồng dự kiến</dt>
                <dd><Money value={priced.commissionExpected} className="font-semibold" /></dd>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <dt>Tổng theo giá niêm yết</dt>
                <dd><Money value={priced.subtotal} /></dd>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <dt>Bạn trả</dt>
                <dd><Money value={priced.partnerPayable ?? 0} /></dd>
              </div>
              <div className="flex justify-between text-green-700">
                <dt>Tiết kiệm</dt>
                <dd><Money value={priced.subtotal - (priced.partnerPayable ?? 0)} className="font-semibold" /></dd>
              </div>
            </>
          )}
        </dl>
      )}

      <label className={labelCls}>
        Điểm giao hàng
        <textarea
          value={draft.deliveryAddress}
          onChange={(e) => onDelivery(e.target.value)}
          rows={2}
          maxLength={500}
          className={`${field} py-2`}
        />
      </label>
      <label className={labelCls}>
        Ghi chú (không bắt buộc)
        <textarea
          value={draft.note}
          onChange={(e) => onNote(e.target.value)}
          rows={2}
          maxLength={1000}
          className={`${field} py-2`}
        />
      </label>

      {changes && (
        <div role="alert" className="rounded-lg border border-amber-400 bg-amber-50 p-3">
          <p className="font-semibold">Đơn có thay đổi so với lúc bạn chọn (tô vàng ở trên).</p>
          <p>Kiểm tra lại rồi bấm &quot;Đồng ý và gửi lại&quot;, hoặc &quot;Sửa đơn&quot; để chỉnh.</p>
        </div>
      )}
      {error && (
        <p role="alert" className="font-semibold text-red-700">
          {error}
        </p>
      )}

      {changes ? (
        <button
          type="button"
          disabled={pending || !priced || !draft.deliveryAddress.trim()}
          onClick={() => onSubmit(true)}
          className="h-12 rounded-lg bg-amber-600 text-lg font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Đang xử lý...' : 'Đồng ý và gửi lại'}
        </button>
      ) : (
        <button
          type="button"
          disabled={pending || !priced || !draft.deliveryAddress.trim()}
          onClick={() => onSubmit(false)}
          className="h-12 rounded-lg bg-green-700 text-lg font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Đang gửi đơn...' : 'Gửi đơn'}
        </button>
      )}
    </section>
  )
}
