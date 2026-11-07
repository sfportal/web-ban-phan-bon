import 'server-only'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export type PartnerSession = {
  userId: string
  partnerId: string
  kind: 'commission' | 'wholesale'
  tierId: string
  name: string
  deliveryAddress: string
}

/**
 * Đối tác đang hoạt động của phiên hiện tại. Chưa đăng nhập → /dang-nhap; chờ duyệt
 * → /cho-duyet; bị khóa → đăng xuất rồi /dang-nhap?locked=1; không phải đối tác → /.
 */
export async function requirePartner(): Promise<PartnerSession> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/dang-nhap')

  const { data: partner } = await supabase
    .from('partners')
    .select('id, name, delivery_address, status, tier_id, partner_tiers(kind)')
    .eq('user_id', user.id)
    .maybeSingle()
    .throwOnError()
  if (!partner) redirect('/')

  if (partner.status === 'locked') {
    await supabase.auth.signOut()
    redirect('/dang-nhap?locked=1')
  }
  // Đối tác chỉ hoạt động được khi đã duyệt và gán bậc.
  if (partner.status !== 'active' || !partner.tier_id || !partner.partner_tiers) redirect('/cho-duyet')

  return {
    userId: user.id,
    partnerId: partner.id,
    kind: partner.partner_tiers.kind,
    tierId: partner.tier_id,
    name: partner.name,
    deliveryAddress: partner.delivery_address ?? '',
  }
}

/** Nhân viên cửa hàng có vai trò tối thiểu `min`. Chưa đăng nhập → /dang-nhap; không đủ quyền → /. */
export async function requireStaff(
  min: 'staff' | 'admin' = 'staff',
): Promise<{ userId: string; role: 'admin' | 'staff' }> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/dang-nhap')

  const { data: staff } = await supabase
    .from('staff').select('role').eq('user_id', user.id).maybeSingle().throwOnError()
  if (!staff || (min === 'admin' && staff.role !== 'admin')) redirect('/')

  return { userId: user.id, role: staff.role }
}
