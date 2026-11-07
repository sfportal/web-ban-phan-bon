'use client'

import { Banknote, Landmark } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { Money } from '@/components/Money'
import { Field, Input, Textarea } from '@/components/ui'
import { useCart } from '@/lib/cart/use-cart'
import type { CatalogProduct } from '@/lib/catalog/queries'
import { formatVnd } from '@/lib/format'
import { submitRetailOrder } from '@/lib/orders/actions'
import type { Change, SubmitError } from '@/lib/orders/submit'
import { RETAIL_PHONE_HINT } from '@/lib/site-copy'

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

/**
 * Form đặt hàng của khách lẻ, đặt dưới giỏ hàng. `prices` là giá bán server tính lúc tải trang;
 * server vẫn tính lại khi gửi. Có thay đổi → hiện danh sách và nút "Đồng ý và gửi lại".
 */
export function RetailForm({ products, prices }: { products: CatalogProduct[]; prices: Record<string, number> }) {
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

  const lines = items.flatMap(({ productId, qty }) => {
    const p = byId.get(productId)
    return p && p.inStock ? [{ productId, qty, seenSalePrice: prices[productId] ?? p.listPrice }] : []
  })

  if (!hydrated || items.length === 0) return null

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    const form = new FormData(e.currentTarget)
    const text = (k: string) => String(form.get(k) ?? '')
    // Đang hiện thay đổi → lần bấm này là "Đồng ý và gửi lại".
    const acceptChanges = changes !== null
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
          acceptChanges,
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5" noValidate>
      <h2 className="text-xl font-bold tracking-tight text-ink">Thông tin đặt hàng</h2>
      <Field label="Họ tên">
        <Input name="name" required maxLength={200} autoComplete="name" />
      </Field>
      <Field label="Số điện thoại" hint={RETAIL_PHONE_HINT}>
        <Input name="phone" type="tel" inputMode="tel" required maxLength={30} autoComplete="tel" />
      </Field>
      <Field label="Địa chỉ giao hàng">
        <Textarea name="address" required maxLength={500} rows={2} autoComplete="street-address" />
      </Field>
      <Field label="Ghi chú (không bắt buộc)">
        <Textarea name="note" maxLength={1000} rows={2} />
      </Field>
      {/* Ô bẫy chống spam: người dùng không thấy, bot hay điền. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 font-semibold text-ink">Thanh toán</legend>
        {(
          [
            ['cod', 'Trả tiền khi nhận hàng (COD)', Banknote],
            ['transfer', 'Chuyển khoản ngân hàng', Landmark],
          ] as const
        ).map(([value, text, Icon]) => (
          <label
            key={value}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-stone-300 px-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft/60 has-[:checked]:ring-1 has-[:checked]:ring-primary"
          >
            <input
              type="radio"
              name="paymentMethod"
              value={value}
              checked={paymentMethod === value}
              onChange={() => setPaymentMethod(value)}
              className="size-5 accent-[#166534]"
            />
            <span className="flex-1">{text}</span>
            <Icon aria-hidden className="size-5 text-stone-500" />
          </label>
        ))}
      </fieldset>

      {/* Điện thoại: thông báo + nút đặt hàng dính đáy màn hình; máy tính: cuối form. */}
      <div data-bottom-bar="lg" className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 border-t border-stone-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)] backdrop-blur lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
        {changes && (
          <div role="alert" className="max-h-[40vh] overflow-y-auto rounded-xl border border-amber-400 bg-amber-50 p-3">
            <p className="font-semibold">Giỏ hàng vừa có thay đổi:</p>
            <ul className="list-disc pl-5">
              {changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p>Giỏ hàng đã cập nhật theo giá mới. Kiểm tra lại rồi bấm &quot;Đồng ý và gửi lại&quot;.</p>
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
          className={`flex h-[52px] w-full items-center justify-center rounded-xl px-5 text-lg font-semibold text-white transition-colors disabled:opacity-50 ${changes ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:bg-primary-hover'}`}
        >
          {pending ? 'Đang gửi đơn...' : changes
            ? <span>Đồng ý và gửi lại · <Money value={total} /></span>
            : <span>Đặt hàng · <Money value={total} /></span>}
        </button>
      </div>
    </form>
  )
}
