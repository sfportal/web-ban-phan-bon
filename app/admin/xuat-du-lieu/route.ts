import type { NextRequest } from 'next/server'
import { exportCommissions } from '@/lib/admin/commission-actions'
import { exportOrders } from '@/lib/admin/orders-actions'
import { exportAll } from '@/lib/admin/settings-actions'
import { requireStaff } from '@/lib/auth/guards'
import { vnDateInput, vnDateStart } from '@/lib/format'

// Tải file Excel. Một route cho mọi loại xuất (?loai=…):
//   don-hang&tu=YYYY-MM-DD&den=YYYY-MM-DD  — dòng đơn theo ngày tạo (nhân viên / kế toán)
//   hoa-hong&ky=YYYY-MM                    — hoa hồng theo kỳ (admin)
//   tat-ca                                 — sao lưu mỗi bảng một sheet (admin)
// Quyền: requireStaff() ở đây chặn người ngoài (redirect /dang-nhap hoặc /); từng hàm xuất
// tự kiểm tra lại vai trò tối thiểu của nó.

function xlsx(file: Buffer, name: string): Response {
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  })
}

const bad = (message: string) => new Response(message, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

export async function GET(request: NextRequest) {
  await requireStaff()
  const q = request.nextUrl.searchParams
  switch (q.get('loai')) {
    case 'don-hang': {
      const tu = q.get('tu') ?? ''
      const den = q.get('den') ?? ''
      const from = vnDateStart(tu)
      const to = vnDateStart(den, 1) // ngày kết thúc tính cả ngày
      if (!from || !to || to <= from) return bad('Khoảng ngày không hợp lệ')
      if (+to - +from > 366 * 86400_000) return bad('Tối đa 366 ngày mỗi lần xuất')
      return xlsx(await exportOrders(from, to), `don-hang_${vnDateInput(from)}_${den}.xlsx`)
    }
    case 'hoa-hong': {
      const ky = q.get('ky') ?? ''
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ky)) return bad('Kỳ không hợp lệ')
      return xlsx(await exportCommissions(ky), `hoa-hong_${ky}.xlsx`)
    }
    case 'tat-ca':
      return xlsx(await exportAll(), `du-lieu_${vnDateInput(new Date())}.xlsx`)
    default:
      return bad('Loại xuất không hợp lệ')
  }
}
