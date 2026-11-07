'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { saveProductRate } from '@/lib/admin/tiers-actions'

type Opt = { id: string; name: string }
type Row = { tierId: string; tierName: string; productId: string; productName: string; rate: string }
const input = 'h-11 rounded-lg border border-gray-300 px-3 text-base'

/** Mức riêng theo sản phẩm (ghi đè mức theo nhóm). */
export function ProductRates({ rows, tiers, products, readOnly }: { rows: Row[]; tiers: Opt[]; products: Opt[]; readOnly: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')
  const run = (tierId: string, productId: string, rate: number | null) =>
    start(async () => {
      const res = await saveProductRate(tierId, productId, rate)
      setMsg(res.status === 'ok' ? '' : res.message)
      if (res.status === 'ok') router.refresh()
    })
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0
        ? <p className="text-gray-600">Chưa có mức riêng theo sản phẩm.</p>
        : (
          <ul className="divide-y rounded-xl border border-gray-200">
            {rows.map((r) => (
              <li key={`${r.tierId}|${r.productId}`} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>{r.productName} · {r.tierName}: <b>{r.rate}%</b></span>
                {!readOnly && (
                  <button type="button" disabled={pending} onClick={() => run(r.tierId, r.productId, null)} className="h-11 rounded-lg border border-red-300 px-4 font-semibold text-red-700 disabled:opacity-60">Xóa</button>
                )}
              </li>
            ))}
          </ul>
        )}
      {!readOnly && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            const raw = String(form.get('rate') ?? '').trim().replace(',', '.')
            if (!/^\d+(\.\d+)?$/.test(raw)) { setMsg('Tỷ lệ không hợp lệ'); return }
            run(String(form.get('tierId')), String(form.get('productId')), Number(raw))
          }}
        >
          <select name="tierId" aria-label="Bậc" className={input}>{tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select name="productId" aria-label="Sản phẩm" className={`${input} min-w-0 flex-1`}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input name="rate" inputMode="decimal" placeholder="%" aria-label="Tỷ lệ (%)" className={`${input} w-24`} />
          <button type="submit" disabled={pending} className="h-11 rounded-lg bg-green-700 px-4 font-semibold text-white disabled:opacity-60">Lưu mức riêng</button>
          {msg && <p role="alert" className="w-full text-red-700">{msg}</p>}
        </form>
      )}
    </div>
  )
}
