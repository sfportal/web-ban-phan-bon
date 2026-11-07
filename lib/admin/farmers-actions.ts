'use server'
// Server Actions quản trị nông dân.
import { z } from 'zod'
import { requireStaff } from '@/lib/auth/guards'
import { adminClient } from '@/lib/supabase/admin'

export type TransferResult =
  | { status: 'ok' }
  | { status: 'farmer_not_found' }
  | { status: 'partner_not_eligible' } // chỉ chuyển sang CTV commission đang active
  | { status: 'same_owner' }

/** Chuyển nông dân sang CTV (bậc commission, đang active); ghi farmer_transfer_log qua RPC transfer_farmer. */
export async function transferFarmer(farmerId: string, toPartnerId: string): Promise<TransferResult> {
  const { userId } = await requireStaff('admin')
  if (!z.uuid().safeParse(farmerId).success) return { status: 'farmer_not_found' }
  if (!z.uuid().safeParse(toPartnerId).success) return { status: 'partner_not_eligible' }
  const db = adminClient()
  const { data: farmer } = await db.from('farmers').select('owner_partner_id').eq('id', farmerId).maybeSingle().throwOnError()
  if (!farmer) return { status: 'farmer_not_found' }
  if (farmer.owner_partner_id === toPartnerId) return { status: 'same_owner' }
  const { data: to } = await db.from('partners').select('status, partner_tiers(kind)').eq('id', toPartnerId).maybeSingle().throwOnError()
  if (!to || to.status !== 'active' || to.partner_tiers?.kind !== 'commission') return { status: 'partner_not_eligible' }
  const { error } = await db.rpc('transfer_farmer', { p_farmer_id: farmerId, p_to_partner: toPartnerId, p_actor: userId })
  if (error) {
    if (error.message.includes('farmer_not_found')) return { status: 'farmer_not_found' }
    throw error
  }
  return { status: 'ok' }
}
