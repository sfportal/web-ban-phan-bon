import { Suspense } from 'react'
import { Download } from 'lucide-react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { CommissionPayout, type EntryRow } from '@/components/admin/CommissionPayout'
import { Button, buttonClass, Input } from '@/components/ui'
import { commissionReport } from '@/lib/admin/commission-actions'
import { requireStaff } from '@/lib/auth/guards'
import { vnPeriod } from '@/lib/format'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'

export const metadata = { title: `Hoa hồng — ${SITE_NAME}` }

const TITLE = 'Hoa hồng'
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
      <PageHeader
        title={TITLE}
        subtitle="Hoa hồng ghi nhận khi đơn chuyển sang “Đã thu đủ tiền”; trả hàng sau đó tạo dòng âm vào kỳ trả hàng."
        actions={
          <>
            <form action="/admin/hoa-hong" className="flex items-end gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-stone-700">Kỳ (tháng)</span>
                <Input type="month" name="ky" defaultValue={period} required className="w-auto" />
              </label>
              <Button type="submit" variant="secondary">Xem</Button>
            </form>
            {role === 'admin' && (
              <a href={`/admin/xuat-du-lieu?loai=hoa-hong&ky=${period}`} download className={buttonClass({ variant: 'secondary', className: 'self-end' })}>
                <Download aria-hidden className="size-5" />Xuất Excel
              </a>
            )}
          </>
        }
      />
      <CommissionPayout period={period} report={report} entries={rows} canPay={role === 'admin'} />
    </>
  )
}

export default function CommissionsPage(props: PageProps<'/admin/hoa-hong'>) {
  return (
    <AdminMain>
      <Suspense fallback={<><PageHeader title={TITLE} /><Loading /></>}>
        <Commissions searchParams={props.searchParams} />
      </Suspense>
    </AdminMain>
  )
}
