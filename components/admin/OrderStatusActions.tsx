'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { setOrderStatus } from '@/lib/admin/orders-actions'
import { STATUS_LABEL, TRANSITIONS, type OrderStatus } from '@/lib/orders/status'

const DANGER: OrderStatus[] = ['cancelled', 'returned']

/** Nút đổi trạng thái: chỉ các trạng thái đích hợp lệ theo TRANSITIONS, kèm ghi chú tùy chọn. */
export function OrderStatusActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const targets = TRANSITIONS[status]
  if (targets.length === 0) return null

  const change = (to: OrderStatus) => {
    if (DANGER.includes(to) && !window.confirm(`Chuyển đơn sang "${STATUS_LABEL[to]}"?`)) return
    start(async () => {
      setMsg(null)
      try {
        const res = await setOrderStatus(orderId, to, note)
        if ('error' in res) setMsg('Đơn đã đổi trạng thái ở nơi khác, không chuyển được. Trang đã tải lại.')
        else setNote('')
        router.refresh()
      } catch {
        setMsg('Không đổi được trạng thái. Kiểm tra kết nối mạng rồi thử lại.')
      }
    })
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3" aria-label="Đổi trạng thái">
      <h2 className="text-lg font-bold">Đổi trạng thái</h2>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="Ghi chú (không bắt buộc)"
        aria-label="Ghi chú đổi trạng thái"
        className="h-11 rounded-lg border border-gray-300 px-3 text-base"
      />
      <div className="flex flex-wrap gap-2">
        {targets.map((to) => (
          <button
            key={to}
            type="button"
            disabled={pending}
            onClick={() => change(to)}
            className={`h-11 rounded-lg px-4 font-semibold disabled:opacity-50 ${
              DANGER.includes(to) ? 'border border-red-700 text-red-700' : 'bg-green-700 text-white'
            }`}
          >
            {STATUS_LABEL[to]}
          </button>
        ))}
      </div>
      {msg && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{msg}</p>}
    </section>
  )
}
