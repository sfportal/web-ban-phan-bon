'use server'
// Server Actions hoa hồng: báo cáo theo kỳ (nhân viên xem), đánh dấu đã chi và xuất Excel (admin).
import { z } from 'zod'
import { requireStaff } from '@/lib/auth/guards'
import { buildCommissionWorkbook, type CommissionRow } from '@/lib/excel/export'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/
const uuid = z.guid()
const CHUNK = 200

function checkPeriod(period: unknown): string {
  if (typeof period !== 'string' || !PERIOD.test(period)) throw new Error('Kỳ không hợp lệ (YYYY-MM)')
  return period
}

async function report(period: string): Promise<CommissionRow[]> {
  const db = adminClient()
  const entries = await fetchAll((from, to) =>
    db.from('commission_entries').select('id, partner_id, kind, amount, status, partners(name, phone)')
      .eq('period', period).order('id').range(from, to).throwOnError())
  const rows = new Map<string, CommissionRow>()
  for (const e of entries) {
    let r = rows.get(e.partner_id)
    if (!r) {
      r = {
        partnerId: e.partner_id, partnerName: e.partners?.name ?? '', phone: e.partners?.phone ?? '',
        earned: 0, reversed: 0, net: 0, pending: 0, paid: 0,
      }
      rows.set(e.partner_id, r)
    }
    const amount = Number(e.amount)
    if (e.kind === 'earn') r.earned += amount
    else r.reversed += amount
    r.net += amount
    if (e.status === 'pending') r.pending += amount
    else r.paid += amount
  }
  return [...rows.values()].sort((a, b) => a.partnerName.localeCompare(b.partnerName, 'vi') || a.phone.localeCompare(b.phone))
}

/** Tổng hợp hoa hồng kỳ `period` (YYYY-MM) theo CTV. net = earned + reversed (reversed ≤ 0). */
export async function commissionReport(period: string): Promise<CommissionRow[]> {
  await requireStaff()
  return report(checkPeriod(period))
}

/** Đánh dấu đã chi: chỉ đổi dòng `pending` (paid_at = lúc này); dòng đã chi giữ nguyên. */
export async function markCommissionsPaid(entryIds: string[]): Promise<{ updated: number }> {
  await requireStaff('admin')
  if (!Array.isArray(entryIds)) throw new Error('Danh sách không hợp lệ')
  const ids = [...new Set(entryIds.filter((id) => uuid.safeParse(id).success))]
  const db = adminClient()
  const paidAt = new Date().toISOString()
  let updated = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await db.from('commission_entries').update({ status: 'paid', paid_at: paidAt })
      .in('id', ids.slice(i, i + CHUNK)).eq('status', 'pending').select('id').throwOnError()
    updated += data.length
  }
  return { updated }
}

export async function exportCommissions(period: string): Promise<Buffer> {
  await requireStaff('admin')
  const p = checkPeriod(period)
  return buildCommissionWorkbook(p, await report(p))
}
