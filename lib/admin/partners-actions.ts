'use server'
// Server Actions quản trị đối tác. Mỗi action tự gọi requireStaff('admin').
import { randomInt } from 'node:crypto'
import { z } from 'zod'
import { requireStaff } from '@/lib/auth/guards'
import { adminClient } from '@/lib/supabase/admin'

export type PartnerResult =
  | { status: 'ok' }
  | { status: 'not_found' }
  | { status: 'not_pending' }   // approvePartner: chỉ duyệt đối tác đang chờ duyệt
  | { status: 'is_pending' }    // thao tác chỉ dành cho đối tác đã duyệt
  | { status: 'no_tier' }       // mở khóa đối tác chưa có bậc
  | { status: 'invalid_tier' }
  | { status: 'owns_farmers' }  // changePartnerTier: sang bậc đại lý khi còn sở hữu nông dân

const uuid = z.uuid()

async function tierKind(tierId: string): Promise<'commission' | 'wholesale' | null> {
  if (!uuid.safeParse(tierId).success) return null
  const { data } = await adminClient().from('partner_tiers').select('kind').eq('id', tierId).maybeSingle().throwOnError()
  return data?.kind ?? null
}

/** pending → active kèm bậc (bắt buộc). */
export async function approvePartner(id: string, tierId: string): Promise<PartnerResult> {
  await requireStaff('admin')
  if (!uuid.safeParse(id).success) return { status: 'not_found' }
  if (!(await tierKind(tierId))) return { status: 'invalid_tier' }
  const db = adminClient()
  const { data } = await db.from('partners').update({ status: 'active', tier_id: tierId })
    .eq('id', id).eq('status', 'pending').select('id').throwOnError()
  if (data.length) return { status: 'ok' }
  const { data: cur } = await db.from('partners').select('id').eq('id', id).maybeSingle().throwOnError()
  return { status: cur ? 'not_pending' : 'not_found' }
}

/** Khóa / mở khóa. Đối tác chờ duyệt phải qua approvePartner; mở khóa cần đã có bậc. */
export async function setPartnerStatus(id: string, status: 'active' | 'locked'): Promise<PartnerResult> {
  await requireStaff('admin')
  if (status !== 'active' && status !== 'locked') throw new Error('Trạng thái không hợp lệ')
  if (!uuid.safeParse(id).success) return { status: 'not_found' }
  const db = adminClient()
  const { data: cur } = await db.from('partners').select('status, tier_id').eq('id', id).maybeSingle().throwOnError()
  if (!cur) return { status: 'not_found' }
  if (cur.status === 'pending') return { status: 'is_pending' }
  if (status === 'active' && !cur.tier_id) return { status: 'no_tier' }
  await db.from('partners').update({ status }).eq('id', id).throwOnError()
  return { status: 'ok' }
}

/**
 * Đổi bậc của đối tác đã duyệt (đang hoạt động hoặc bị khóa). Đại lý không sở hữu nông dân:
 * sang bậc đại lý chỉ được khi đối tác không còn nông dân nào (admin chuyển nông dân trước).
 */
export async function changePartnerTier(id: string, tierId: string): Promise<PartnerResult> {
  await requireStaff('admin')
  if (!uuid.safeParse(id).success) return { status: 'not_found' }
  const kind = await tierKind(tierId)
  if (!kind) return { status: 'invalid_tier' }
  const db = adminClient()
  const { data: cur } = await db.from('partners').select('status').eq('id', id).maybeSingle().throwOnError()
  if (!cur) return { status: 'not_found' }
  if (cur.status === 'pending') return { status: 'is_pending' }
  if (kind === 'wholesale') {
    const { count } = await db.from('farmers').select('id', { count: 'exact', head: true })
      .eq('owner_partner_id', id).throwOnError()
    if (count) return { status: 'owns_farmers' }
  }
  await db.from('partners').update({ tier_id: tierId }).eq('id', id).throwOnError()
  return { status: 'ok' }
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** Đặt lại mật khẩu: trả mật khẩu tạm 8 ký tự chữ và số, chỉ hiện một lần (không lưu ở đâu). */
export async function resetPartnerPassword(id: string): Promise<{ tempPassword: string }> {
  await requireStaff('admin')
  if (!uuid.safeParse(id).success) throw new Error('Không tìm thấy đối tác')
  const db = adminClient()
  const { data: partner } = await db.from('partners').select('user_id').eq('id', id).maybeSingle().throwOnError()
  if (!partner) throw new Error('Không tìm thấy đối tác')
  let tempPassword = ''
  for (let i = 0; i < 8; i++) tempPassword += ALPHABET[randomInt(ALPHABET.length)]
  const { error } = await db.auth.admin.updateUserById(partner.user_id, { password: tempPassword })
  if (error) throw error
  return { tempPassword }
}
