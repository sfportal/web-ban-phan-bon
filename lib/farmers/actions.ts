'use server'
// Server Actions về nông dân của CTV (bước 1 lên đơn). Danh tính đối tác luôn lấy từ phiên.
import { z } from 'zod'
import { requirePartner } from '@/lib/auth/guards'
import { normalizePhone } from '@/lib/phone'
import { adminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

export type FarmerSummary = { id: string; name: string; phone: string }

export type AddFarmerResult =
  | { status: 'ok'; farmer: FarmerSummary }
  | { status: 'owned_by_other' }
  | { status: 'invalid_phone' }
  | { status: 'missing_fields' }
  | { status: 'not_allowed' }

const addInput = z.object({
  phone: z.string().max(30),
  name: z.string().max(200),
  address: z.string().max(500).optional(),
})

/**
 * "Thêm nhanh" nông dân cho CTV hoa hồng (đại lý → not_allowed). SĐT đã thuộc CTV khác →
 * owned_by_other; SĐT chưa có chủ (khách lẻ) được gán cho CTV này (claim_farmer).
 */
export async function addFarmer(form: { phone: string; name: string; address?: string }): Promise<AddFarmerResult> {
  const session = await requirePartner()
  if (session.kind !== 'commission') return { status: 'not_allowed' }
  const parsed = addInput.safeParse(form)
  if (!parsed.success) return { status: 'missing_fields' }
  const name = parsed.data.name.trim()
  if (!name) return { status: 'missing_fields' }
  const phone = normalizePhone(parsed.data.phone)
  if (!phone) return { status: 'invalid_phone' }

  const db = adminClient()
  const { data } = await db
    .rpc('claim_farmer', {
      p_partner_id: session.partnerId,
      p_phone: phone,
      p_name: name,
      p_address: parsed.data.address?.trim() || null,
    })
    .throwOnError()
  const res = data as { status: 'ok'; farmer_id: string } | { status: 'owned_by_other' }
  if (res.status !== 'ok') return { status: 'owned_by_other' }

  const { data: farmer } = await db
    .from('farmers').select('id, name, phone').eq('id', res.farmer_id).single().throwOnError()
  return { status: 'ok', farmer }
}

const LIMIT = 20

/** Mẫu ilike "chứa q": thoát \ % _ (ký tự đại diện của LIKE) và bỏ * (PostgREST coi là %). */
function containsPattern(q: string): string {
  return `%${q.replace(/\*/g, '').replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/** Nông dân của CTV đang đăng nhập theo tên hoặc một phần SĐT; q rỗng → 20 khách đầu theo tên. */
export async function searchMyFarmers(q: string): Promise<FarmerSummary[]> {
  const session = await requirePartner()
  const query = typeof q === 'string' ? q.trim().slice(0, 100) : ''
  // RLS chỉ cho thấy khách của chính đối tác; lọc owner thêm một lần cho chắc.
  const base = () =>
    createServerClient()
      .from('farmers').select('id, name, phone').eq('owner_partner_id', session.partnerId)
      .order('name').order('phone').limit(LIMIT)

  if (!query) return (await base().throwOnError()).data

  const digits = query.replace(/[\s.\-()]/g, '')
  const searches = [base().ilike('name', containsPattern(query)).throwOnError()]
  if (/^\+?\d+$/.test(digits)) {
    searches.push(base().ilike('phone', containsPattern(digits.replace(/^\+?84/, '0'))).throwOnError())
  }
  const found = new Map<string, FarmerSummary>()
  for (const { data } of await Promise.all(searches)) for (const f of data) found.set(f.id, f)
  return [...found.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.phone.localeCompare(b.phone))
    .slice(0, LIMIT)
}
