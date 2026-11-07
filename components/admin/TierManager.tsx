'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { saveTier } from '@/lib/admin/tiers-actions'

type Tier = { id: string; name: string; kind: 'commission' | 'wholesale'; partnerCount: number }
const input = 'h-11 rounded-xl border border-stone-300 bg-white px-3 text-base'
const KIND_LABEL = { commission: 'CTV (hoa hồng)', wholesale: 'Đại lý (giá sỉ)' }

function TierForm({ tier, readOnly }: { tier?: Tier; readOnly: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        const isNew = !tier
        const target = e.currentTarget
        start(async () => {
          const res = await saveTier(form)
          setMsg(res.status === 'ok' ? (tier ? 'Đã lưu' : '')
            : res.status === 'tier_in_use' ? 'Bậc đã có đối tác, không đổi loại được' : res.message)
          if (res.status === 'ok') { if (isNew) target.reset(); router.refresh() }
        })
      }}
    >
      {tier && <input type="hidden" name="id" value={tier.id} />}
      <input name="name" defaultValue={tier?.name} required readOnly={readOnly} placeholder="Tên bậc mới" aria-label="Tên bậc" className={`${input} min-w-0 flex-1`} />
      <select name="kind" defaultValue={tier?.kind ?? 'commission'} disabled={readOnly} aria-label="Loại bậc" className={input}>
        <option value="commission">{KIND_LABEL.commission}</option>
        <option value="wholesale">{KIND_LABEL.wholesale}</option>
      </select>
      {!readOnly && <button type="submit" disabled={pending} className="h-11 rounded-xl bg-primary px-4 font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60">{tier ? 'Lưu' : 'Thêm bậc'}</button>}
      {tier && <span className="text-sm text-stone-600">{tier.partnerCount} đối tác</span>}
      {msg && <p role="alert" className="w-full text-red-700">{msg}</p>}
    </form>
  )
}

export function TierManager({ tiers, readOnly }: { tiers: Tier[]; readOnly: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {tiers.map((t) => <li key={t.id} className="px-4 py-3 even:bg-stone-50/70"><TierForm tier={t} readOnly={readOnly} /></li>)}
      </ul>
      {!readOnly && <TierForm readOnly={false} />}
    </div>
  )
}
