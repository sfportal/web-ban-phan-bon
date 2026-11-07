'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { saveRateGrid } from '@/lib/admin/tiers-actions'

type Tier = { id: string; name: string }
type Cat = { id: string; name: string }

/** Lưới bậc × nhóm (% hoa hồng / chiết khấu). Ô trống = không có mức (xóa dòng). Lưu cả lưới một lần. */
export function RateGrid({
  tiers, categories, rates, readOnly,
}: { tiers: Tier[]; categories: Cat[]; rates: Record<string, string>; readOnly: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')
  if (tiers.length === 0 || categories.length === 0) {
    return <p className="py-4 text-gray-600">Cần có ít nhất một bậc và một nhóm để cấu hình tỷ lệ.</p>
  }
  const key = (t: string, c: string) => `${t}|${c}`
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        const errors: string[] = []
        const payload = tiers.map((t) => {
          const grid: Record<string, number | null> = {}
          for (const c of categories) {
            const raw = String(form.get(key(t.id, c.id)) ?? '').trim().replace(',', '.')
            if (raw === '') { grid[c.id] = null; continue }
            const n = /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN
            if (Number.isNaN(n)) errors.push(`${t.name} · ${c.name}: không phải số`)
            grid[c.id] = n
          }
          return [t.id, grid] as const
        })
        if (errors.length) { setMsg(errors[0]); return }
        start(async () => {
          for (const [tierId, grid] of payload) {
            const res = await saveRateGrid(tierId, grid)
            if (res.status === 'invalid') { setMsg(res.message); return }
          }
          setMsg('Đã lưu')
          router.refresh()
        })
      }}
    >
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full min-w-[28rem] text-left">
          <thead className="bg-gray-50 text-sm text-gray-600">
            <tr><th className="p-3">Nhóm</th>{tiers.map((t) => <th key={t.id} className="p-3">{t.name} (%)</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="p-3">{c.name}</td>
                {tiers.map((t) => (
                  <td key={t.id} className="p-2">
                    <input
                      name={key(t.id, c.id)}
                      defaultValue={rates[key(t.id, c.id)] ?? ''}
                      readOnly={readOnly}
                      inputMode="decimal"
                      aria-label={`${t.name} · ${c.name}`}
                      className="h-11 w-24 rounded-lg border border-gray-300 px-3 text-base"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="h-11 rounded-lg bg-green-700 px-4 font-semibold text-white disabled:opacity-60">Lưu lưới tỷ lệ</button>
          {msg && <p role="status" className="text-gray-700">{msg}</p>}
        </div>
      )}
    </form>
  )
}
