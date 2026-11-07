'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { transferFarmer } from '@/lib/admin/farmers-actions'

const MESSAGES = {
  farmer_not_found: 'Không tìm thấy nông dân',
  partner_not_eligible: 'Chỉ chuyển được sang CTV (hoa hồng) đang hoạt động',
  same_owner: 'Nông dân đã thuộc CTV này',
} as const

export function FarmerTransfer({ farmerId, ownerId, partners }: { farmerId: string; ownerId: string | null; partners: { id: string; label: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [to, setTo] = useState('')
  const [msg, setMsg] = useState('')
  const options = partners.filter((p) => p.id !== ownerId)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Chuyển sang CTV" className="h-11 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-base">
        <option value="" disabled>Chọn CTV nhận</option>
        {options.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <button
        type="button"
        disabled={pending || !to}
        onClick={() => {
          if (!confirm('Chuyển nông dân này sang CTV đã chọn?')) return
          start(async () => {
            const res = await transferFarmer(farmerId, to)
            setMsg(res.status === 'ok' ? 'Đã chuyển' : MESSAGES[res.status])
            if (res.status === 'ok') { setTo(''); router.refresh() }
          })
        }}
        className="h-11 rounded-xl bg-primary px-4 font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        Chuyển chủ
      </button>
      {msg && <p role="status" className="w-full text-stone-700">{msg}</p>}
    </div>
  )
}
