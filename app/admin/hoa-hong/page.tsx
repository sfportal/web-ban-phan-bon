import { Suspense } from 'react'
import { CommissionPayout, type EntryRow } from '@/components/admin/CommissionPayout'
import { commissionReport } from '@/lib/admin/commission-actions'
import { requireStaff } from '@/lib/auth/guards'
import { vnPeriod } from '@/lib/format'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'

export const metadata = { title: `Hoa hồng — ${SITE_NAME}` }

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/

async function Commissions({ searchParams }: Pick<PageProps<'/admin/hoa-hong'>, 'searchParams'>) {
  const { role } = await requireStaff()
  const raw = (await searchParams).ky
  const period = typeof raw === 'string' && PERIOD.test(raw) ? raw : vnPeriod(new Date())
  const db = adminClient()
  const [report, entries] = await Promise.all([
    commissionReport(period),
    fetchAll((from, to) =>
      db.from('commission_entries').select('id, partner_id, kind, amount, status, paid_at, created_at, orders(id, code)')
        .eq('period', period).order('created_at').order('id').range(from, to).throwOnError()),
  ])
  const rows: EntryRow[] = entries.map((e) => ({
    id: e.id, partnerId: e.partner_id, kind: e.kind, amount: Number(e.amount), status: e.status,
    paidAt: e.paid_at, createdAt: e.created_at, orderId: e.orders?.id ?? '', orderCode: e.orders?.code ?? '',
  }))
  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <form action="/admin/hoa-hong" className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-700">Kỳ (tháng)</span>
            <input type="month" name="ky" defaultValue={period} required className="h-11 rounded-lg border border-gray-300 px-3 text-base" />
          </label>
          <button type="submit" className="h-11 rounded-lg bg-green-700 px-4 font-semibold text-white">Xem</button>
        </form>
        {role === 'admin' && (
          <a href={`/admin/xuat-du-lieu?loai=hoa-hong&ky=${period}`} download className="flex h-11 items-center rounded-lg border border-green-700 px-4 font-semibold text-green-800">
            Xuất Excel
          </a>
        )}
      </div>
      <p className="text-sm text-gray-600">
        Hoa hồng ghi nhận khi đơn chuyển sang “Đã thu đủ tiền”; trả hàng sau đó tạo dòng âm vào kỳ trả hàng.
      </p>
      <CommissionPayout period={period} report={report} entries={rows} canPay={role === 'admin'} />
    </>
  )
}

export default function CommissionsPage(props: PageProps<'/admin/hoa-hong'>) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Hoa hồng</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Commissions searchParams={props.searchParams} />
      </Suspense>
    </main>
  )
}
