'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { Money } from '@/components/Money'
import { useCart } from '@/lib/cart/use-cart'
import type { CatalogProduct } from '@/lib/catalog/queries'
import { formatVnd } from '@/lib/format'
import { submitRetailOrder } from '@/lib/orders/actions'
import type { Change, SubmitError } from '@/lib/orders/submit'
import { salePrice, type PromotionInput } from '@/lib/pricing'

const subscribeNoop = () => () => {}

const ERRORS: Record<SubmitError, string> = {
  empty_order: 'Giỏ hàng chưa có sản phẩm nào đặt được.',
  invalid_qty: 'Số lượng không hợp lệ. Vui lòng kiểm tra lại giỏ hàng.',
  unavailable: 'Có sản phẩm đã hết hàng hoặc ngừng bán. Vui lòng kiểm tra lại giỏ hàng.',
  invalid_phone: 'Số điện thoại không hợp lệ.',
  rate_limited: 'Bạn vừa đặt nhiều đơn liên tiếp. Vui lòng thử lại sau ít phút hoặc gọi cho cửa hàng.',
  farmer_not_owned: 'Không gửi được đơn. Vui lòng thử lại.',
  missing_fields: 'Vui lòng nhập đủ họ tên, số điện thoại và địa chỉ giao hàng.',
}

/** UUID v4 cho client_key; crypto.randomUUID chỉ có trong secure context. */
function newClientKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function describeChange(c: Change, name: string): string {
  if (c.field === 'price') return `${name}: giá đổi từ ${formatVnd(Number(c.old))} thành ${formatVnd(Number(c.new))}`
  if (c.field === 'stock') return `${name}: đã hết hàng`
  return `${name}: không còn được bán`
}

const field = 'h-12 w-full rounded-lg border border-gray-300 px-3 text-base'
const labelCls = 'flex flex-col gap-1 font-semibold'

/** Form đặt hàng của khách lẻ, đặt dưới giỏ hàng. Server tính lại toàn bộ giá. */
export function RetailForm({ products, promos }: { products: CatalogProduct[]; promos: PromotionInput[] }) {
  const router = useRouter()
  const { items, clear } = useCart()
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'transfer'>('cod')
  const [error, setError] = useState<string | null>(null)
  const [changes, setChanges] = useState<string[] | null>(null)
  const [pending, startTransition] = useTransition()
  // Giữ cùng client_key cho mọi lần gửi lại của một đơn (chống tạo trùng khi bấm lại).
  const clientKey = useRef<string | null>(null)

  const now = new Date()
  const lines = items.flatMap(({ productId, qty }) => {
    const p = byId.get(productId)
    return p && p.inStock ? [{ productId, qty, seenSalePrice: salePrice(p, promos, now).price }] : []
  })

  if (!hydrated || items.length === 0) return null

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    const form = new FormData(e.currentTarget)
    const text = (k: string) => String(form.get(k) ?? '')
    setError(null)
    setChanges(null)
    clientKey.current ??= newClientKey()
    const key = clientKey.current
    startTransition(async () => {
      try {
        const res = await submitRetailOrder({
          clientKey: key,
          lines,
          name: text('name'),
          phone: text('phone'),
          address: text('address'),
          note: text('note'),
          paymentMethod,
          honeypot: text('website'),
        })
        if (res.status === 'ok') {
          clientKey.current = null
          clear()
          router.push(`/dat-hang-thanh-cong/${encodeURIComponent(res.code)}?id=${res.orderId}`)
        } else if (res.status === 'changed') {
          setChanges(res.changes.map((c) => describeChange(c, byId.get(c.productId)?.name ?? 'Một sản phẩm')))
          router.refresh() // tải lại giá/tồn kho mới cho giỏ hàng
        } else {
          setError(ERRORS[res.error])
        }
      } catch {
        setError('Không gửi được đơn. Kiểm tra kết nối mạng và thử lại.')
      }
    })
  }

  const total = lines.reduce((s, l) => s + l.seenSalePrice * l.qty, 0)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t pt-4" noValidate>
      <h2 className="text-xl font-bold">Thông tin đặt hàng</h2>
      <label className={labelCls}>
        Họ tên
        <input name="name" required maxLength={200} autoComplete="name" className={field} />
      </label>
      <label className={labelCls}>
        Số điện thoại
        <input name="phone" type="tel" inputMode="tel" required maxLength={30} autoComplete="tel" className={field} />
      </label>
      <label className={labelCls}>
        Địa chỉ giao hàng
        <textarea name="address" required maxLength={500} rows={2} autoComplete="street-address" className={`${field} h-auto py-2`} />
      </label>
      <label className={labelCls}>
        Ghi chú (không bắt buộc)
        <textarea name="note" maxLength={1000} rows={2} className={`${field} h-auto py-2`} />
      </label>
      {/* Ô bẫy chống spam: người dùng không thấy, bot hay điền. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Thanh toán</legend>
        {(
          [
            ['cod', 'Trả tiền khi nhận hàng (COD)'],
            ['transfer', 'Chuyển khoản ngân hàng'],
          ] as const
        ).map(([value, text]) => (
          <label key={value} className="flex min-h-11 items-center gap-3 rounded-lg border border-gray-300 px-3">
            <input
              type="radio"
              name="paymentMethod"
              value={value}
              checked={paymentMethod === value}
              onChange={() => setPaymentMethod(value)}
              className="h-5 w-5"
            />
            {text}
          </label>
        ))}
      </fieldset>

      {changes && (
        <div role="alert" className="rounded-lg border border-amber-400 bg-amber-50 p-3">
          <p className="font-semibold">Giỏ hàng vừa có thay đổi:</p>
          <ul className="list-disc pl-5">
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p>Giỏ hàng đã cập nhật theo giá mới. Vui lòng kiểm tra rồi bấm Đặt hàng lần nữa.</p>
        </div>
      )}
      {error && (
        <p role="alert" className="font-semibold text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || lines.length === 0}
        className="flex h-12 items-center justify-center rounded-lg bg-green-700 px-5 text-lg font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Đang gửi đơn...' : <span>Đặt hàng · <Money value={total} /></span>}
      </button>
    </form>
  )
}
