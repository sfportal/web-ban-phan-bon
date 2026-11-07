'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Money } from '@/components/Money'
import { QtyStepper } from '@/components/QtyStepper'
import { staffEditOrder } from '@/lib/admin/orders-actions'
import { formatVnd } from '@/lib/format'
import type { EditResult } from '@/lib/orders/edit'
import type { Change } from '@/lib/orders/submit'

/** Một dòng của đơn khi sửa; `price` = giá bán hiện tại (server tính lúc mở trang). */
export type StaffEditLine = {
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
  not_editable: 'Đơn đã sang trạng thái không sửa được (chỉ sửa khi Mới hoặc Đã xác nhận).',
  empty_order: 'Đơn phải còn ít nhất một sản phẩm. Muốn bỏ cả đơn, hãy chuyển sang "Đã hủy".',
  invalid_qty: 'Số lượng không hợp lệ.',
  unavailable: 'Có sản phẩm đã hết hàng hoặc ngừng bán. Hãy bỏ dòng đó rồi lưu lại.',
  farmer_not_owned: 'Có nông dân không còn thuộc CTV của đơn. Hãy bỏ các dòng đó rồi lưu lại.',
}
const FALLBACK = 'Không lưu được. Kiểm tra kết nối mạng rồi thử lại.'
const btn = 'flex h-11 flex-1 items-center justify-center rounded-lg px-4 font-semibold disabled:opacity-50'

function changeText(c: Change): string {
  if (c.field === 'price') return `giá đổi ${formatVnd(Number(c.old))} → ${formatVnd(Number(c.new))}`
  if (c.field === 'stock') return 'đã hết hàng — hãy bỏ khỏi đơn'
  return 'ngừng bán — hãy bỏ khỏi đơn'
}

/** Nhân viên sửa số lượng / bỏ dòng; server tính lại theo giá hiện tại và bậc của đối tác của đơn. */
export function StaffOrderEdit({ orderId, lines: initialLines }: { orderId: string; lines: StaffEditLine[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [lines, setLines] = useState(initialLines)
  const [changes, setChanges] = useState<Change[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const save = (acceptChanges: boolean) =>
    start(async () => {
      setError(null)
      try {
        const res = await staffEditOrder(
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
          const newPrice = new Map(res.changes.filter((c) => c.field === 'price').map((c) => [c.productId, Number(c.new)]))
          const gone = new Set(res.changes.filter((c) => c.field !== 'price').map((c) => c.productId))
          setLines((ls) => ls.map((l) => ({
            ...l, price: newPrice.get(l.productId) ?? l.price, available: l.available && !gone.has(l.productId),
          })))
        } else {
          setError(ERRORS[res.error] ?? FALLBACK)
          if (res.error === 'not_editable') router.refresh()
        }
      } catch {
        setError(FALLBACK)
      }
    })

  if (!editing) {
    return (
      <button
        type="button"
        className="h-11 self-start rounded-lg border border-green-700 px-4 font-semibold text-green-800"
        onClick={() => { setLines(initialLines); setChanges(null); setError(null); setEditing(true) }}
      >
        Sửa đơn
      </button>
    )
  }

  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const changeOf = new Map((changes ?? []).map((c) => [c.productId, c]))
  const hasGone = lines.some((l) => !l.available)

  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-green-700 p-3" aria-label="Sửa đơn">
      <h2 className="text-lg font-bold">Sửa đơn</h2>
      <p className="text-sm text-gray-700">Đơn được tính lại theo giá, khuyến mãi và bậc hiện tại của đối tác khi lưu.</p>
      <ul className="flex flex-col divide-y">
        {lines.map((l) => {
          const c = changeOf.get(l.productId)
          return (
            <li key={l.key} className="flex flex-col gap-2 py-3">
              <span>
                <span className="block font-semibold">{l.name}</span>
                <span className="text-sm text-gray-600">{l.farmerName ? `${l.farmerName} · ` : ''}{l.unit}</span>
              </span>
              {!l.available ? (
                <span className="text-red-700">Không còn bán — hãy bỏ khỏi đơn</span>
              ) : (
                <span className="flex items-center justify-between gap-2">
                  <QtyStepper value={l.qty} onChange={(qty) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty } : x)))} />
                  <Money value={l.price * l.qty} className="font-semibold" />
                </span>
              )}
              {c && l.available && <span className="text-sm text-amber-800">{changeText(c)}</span>}
              <button type="button" className="h-11 self-start font-semibold text-red-700"
                onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                Bỏ dòng này
              </button>
            </li>
          )
        })}
      </ul>
      <p className="flex justify-between text-lg">
        <span>Tổng theo giá bán</span><Money value={total} className="font-bold" />
      </p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {changes && !hasGone && (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">Giá đã thay đổi. Kiểm tra lại rồi bấm &quot;Lưu với giá mới&quot;.</p>
      )}
      <div className="flex gap-2">
        <button type="button" className={`${btn} border border-gray-300`} disabled={pending} onClick={() => setEditing(false)}>
          Thôi
        </button>
        <button type="button" className={`${btn} bg-green-700 text-white`} disabled={pending || hasGone || lines.length === 0}
          onClick={() => save(changes !== null)}>
          {pending ? 'Đang lưu…' : changes ? 'Lưu với giá mới' : 'Lưu'}
        </button>
      </div>
    </section>
  )
}
