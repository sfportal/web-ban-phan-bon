'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Money } from '@/components/Money'
import { QtyStepper } from '@/components/QtyStepper'
import { formatVnd } from '@/lib/format'
import { cancelMyOrder, editMyOrder, type EditResult } from '@/lib/orders/edit'
import type { Change } from '@/lib/orders/submit'

/** Một dòng của đơn khi sửa; `price` = giá bán hiện tại (server tính lúc mở trang). */
export type EditLine = {
  key: string
  productId: string
  farmerId: string | null
  farmerName: string | null
  name: string
  unit: string
  qty: number
  price: number
  available: boolean
}

type ErrorCode = Extract<EditResult, { status: 'error' }>['error']
const ERRORS: Partial<Record<ErrorCode, string>> = {
  not_editable: 'Đơn đã được cửa hàng xử lý nên không sửa/hủy được nữa.',
  empty_order: 'Đơn phải còn ít nhất một sản phẩm. Muốn bỏ cả đơn, hãy bấm "Hủy đơn".',
  invalid_qty: 'Số lượng không hợp lệ.',
  unavailable: 'Có sản phẩm đã hết hàng hoặc ngừng bán. Hãy bỏ dòng đó rồi lưu lại.',
  farmer_not_owned: 'Có nông dân không còn thuộc danh sách của bạn. Hãy bỏ các dòng đó rồi lưu lại.',
}
const FALLBACK = 'Không lưu được. Kiểm tra kết nối mạng rồi thử lại.'

const btn = 'flex h-11 flex-1 items-center justify-center rounded-xl px-4 font-semibold transition-colors disabled:opacity-50'

function changeText(c: Change): string {
  if (c.field === 'price') return `giá đổi ${formatVnd(Number(c.old))} → ${formatVnd(Number(c.new))}`
  if (c.field === 'stock') return 'đã hết hàng — hãy bỏ khỏi đơn'
  return 'ngừng bán — hãy bỏ khỏi đơn'
}

/** Nút Sửa / Hủy (chỉ khi đơn còn "Mới") và màn sửa số lượng. */
export function OrderActions({
  orderId,
  kind,
  editable,
  lines: initialLines,
}: {
  orderId: string
  kind: 'commission' | 'wholesale'
  editable: boolean
  lines: EditLine[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [lines, setLines] = useState(initialLines)
  const [changes, setChanges] = useState<Change[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  if (!editable) return null

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setError(null)
      try {
        await fn()
      } catch {
        setError(FALLBACK)
      }
    })

  const cancel = () => {
    if (!window.confirm('Hủy đơn này?')) return
    run(async () => {
      const res = await cancelMyOrder(orderId)
      if ('error' in res) setError(ERRORS.not_editable!)
      router.refresh()
    })
  }

  const save = (acceptChanges: boolean) =>
    run(async () => {
      const res = await editMyOrder(
        orderId,
        lines.map((l) => ({ productId: l.productId, qty: l.qty, farmerId: l.farmerId, seenSalePrice: l.price })),
        acceptChanges,
      )
      if (res.status === 'ok') {
        setEditing(false)
        setChanges(null)
        router.refresh()
      } else if (res.status === 'changed') {
        setChanges(res.changes)
        // Cập nhật giá hiển thị theo server để lần bấm "Lưu với giá mới" khớp.
        const newPrice = new Map(res.changes.filter((c) => c.field === 'price').map((c) => [c.productId, Number(c.new)]))
        const gone = new Set(res.changes.filter((c) => c.field !== 'price').map((c) => c.productId))
        setLines((ls) => ls.map((l) => ({
          ...l, price: newPrice.get(l.productId) ?? l.price, available: l.available && !gone.has(l.productId),
        })))
      } else {
        setError(ERRORS[res.error] ?? FALLBACK)
        if (res.error === 'not_editable') router.refresh()
      }
    })

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-800">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className={`${btn} bg-primary text-white hover:bg-primary-hover`} disabled={pending}
            onClick={() => { setLines(initialLines); setChanges(null); setError(null); setEditing(true) }}>
            Sửa
          </button>
          <button type="button" className={`${btn} border border-red-700 bg-white text-red-700 hover:bg-red-50`} disabled={pending} onClick={cancel}>
            {pending ? 'Đang hủy…' : 'Hủy đơn'}
          </button>
        </div>
      </div>
    )
  }

  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const changeOf = new Map((changes ?? []).map((c) => [c.productId, c]))
  const hasGone = lines.some((l) => !l.available)

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-primary bg-white p-4" aria-label="Sửa đơn">
      <h2 className="text-lg font-bold">Sửa đơn</h2>
      <p className="text-sm text-stone-700">Đơn được tính lại theo giá hiện tại khi lưu.</p>
      <ul className="flex flex-col divide-y divide-stone-100">
        {lines.map((l) => {
          const c = changeOf.get(l.productId)
          return (
            <li key={l.key} className="flex flex-col gap-2 py-3">
              <span>
                <span className="block font-semibold">{l.name}</span>
                <span className="text-sm text-stone-600">
                  {kind === 'commission' && l.farmerName ? `${l.farmerName} · ` : ''}{l.unit}
                </span>
              </span>
              {!l.available ? (
                <span className="text-red-700">Không còn bán — hãy bỏ khỏi đơn</span>
              ) : (
                <span className="flex items-center justify-between gap-2">
                  <QtyStepper value={l.qty} onChange={(qty) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty } : x)))} />
                  <Money value={l.price * l.qty} className="font-semibold" />
                </span>
              )}
              {c && l.available && <span className="text-sm font-semibold text-yellow-900">{changeText(c)}</span>}
              <button type="button" className="h-11 self-start font-semibold text-red-700"
                onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                Bỏ dòng này
              </button>
            </li>
          )
        })}
      </ul>
      <p className="flex justify-between text-lg">
        <span>Tổng theo giá bán lẻ</span><Money value={total} className="font-bold" />
      </p>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-800">{error}</p>}
      {changes && !hasGone && (
        <p role="status" className="rounded-xl border border-accent/40 bg-accent-soft p-3 text-yellow-900">Giá đã thay đổi. Kiểm tra lại rồi bấm &quot;Lưu với giá mới&quot;.</p>
      )}
      <div className="flex gap-2">
        <button type="button" className={`${btn} border border-stone-300 bg-white hover:bg-stone-50`} disabled={pending} onClick={() => setEditing(false)}>
          Thôi
        </button>
        <button type="button" className={`${btn} bg-primary text-white hover:bg-primary-hover`} disabled={pending || hasGone || lines.length === 0}
          onClick={() => save(changes !== null)}>
          {pending ? 'Đang lưu…' : changes ? 'Lưu với giá mới' : 'Lưu'}
        </button>
      </div>
    </section>
  )
}
