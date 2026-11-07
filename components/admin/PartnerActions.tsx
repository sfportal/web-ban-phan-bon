'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { approvePartner, changePartnerTier, resetPartnerPassword, setPartnerStatus, type PartnerResult } from '@/lib/admin/partners-actions'

type Tier = { id: string; name: string; kind: 'commission' | 'wholesale' }
const input = 'h-11 rounded-lg border border-gray-300 px-3 text-base'
const btn = 'h-11 rounded-lg px-4 font-semibold disabled:opacity-60'
const MESSAGES: Record<string, string> = {
  not_found: 'Không tìm thấy đối tác', not_pending: 'Đối tác không còn ở trạng thái chờ duyệt', is_pending: 'Đối tác chưa được duyệt',
  no_tier: 'Đối tác chưa có bậc', invalid_tier: 'Bậc không hợp lệ',
}

export function PartnerActions({
  partnerId, status, tierId, tiers,
}: { partnerId: string; status: 'pending' | 'active' | 'locked'; tierId: string | null; tiers: Tier[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')
  // Mật khẩu tạm chỉ nằm trong state của trang này; rời trang hoặc bấm "Đã ghi lại" là mất.
  const [temp, setTemp] = useState('')
  const [tier, setTier] = useState(tierId ?? '')
  const run = (fn: () => Promise<PartnerResult>) =>
    start(async () => {
      const res = await fn()
      setMsg(res.status === 'ok' ? 'Đã lưu' : MESSAGES[res.status] ?? res.status)
      router.refresh()
    })
  const tierSelect = (
    <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Bậc" className={input}>
      <option value="" disabled>Chọn bậc</option>
      {tiers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.kind === 'commission' ? 'CTV' : 'Đại lý'})</option>)}
    </select>
  )
  return (
    <div className="flex flex-col gap-4">
      {status === 'pending' ? (
        <div className="flex flex-wrap gap-2">
          {tierSelect}
          <button type="button" disabled={pending || !tier} onClick={() => run(() => approvePartner(partnerId, tier))} className={`${btn} bg-green-700 text-white`}>Duyệt</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {tierSelect}
            <button type="button" disabled={pending || !tier || tier === tierId} onClick={() => run(() => changePartnerTier(partnerId, tier))} className={`${btn} border border-green-700 text-green-800`}>Đổi bậc</button>
          </div>
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setPartnerStatus(partnerId, status === 'locked' ? 'active' : 'locked'))}
              className={`${btn} border ${status === 'locked' ? 'border-green-700 text-green-800' : 'border-red-300 text-red-700'}`}
            >
              {status === 'locked' ? 'Mở khóa' : 'Khóa tài khoản'}
            </button>
          </div>
        </>
      )}
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm('Đặt lại mật khẩu đối tác? Mật khẩu cũ sẽ không dùng được nữa.')) return
            start(async () => {
              try { setTemp((await resetPartnerPassword(partnerId)).tempPassword); setMsg('') }
              catch { setMsg('Không đặt lại được mật khẩu') }
            })
          }}
          className={`${btn} border border-gray-300`}
        >
          Đặt lại mật khẩu
        </button>
        {temp && (
          <div role="status" className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3">
            <span>Mật khẩu tạm (chỉ hiện một lần): <b className="font-mono text-xl tracking-wider">{temp}</b></span>
            <button type="button" onClick={() => setTemp('')} className={`${btn} border border-gray-300 self-start`}>Đã ghi lại</button>
          </div>
        )}
      </div>
      {msg && <p role="status" className="text-gray-700">{msg}</p>}
    </div>
  )
}
