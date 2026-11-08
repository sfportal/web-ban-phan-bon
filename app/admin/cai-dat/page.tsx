import { Suspense } from 'react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { SettingsForm, type SettingsValues } from '@/components/admin/SettingsForm'
import { Download } from 'lucide-react'
import { buttonClass, Card } from '@/components/ui'
import { requireStaff } from '@/lib/auth/guards'
import { DEFAULT_MIN_PAYOUT } from '@/lib/payouts/validate'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'

export const metadata = { title: `Cài đặt — ${SITE_NAME}` }

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

async function Settings() {
  await requireStaff('admin')
  const { data } = await adminClient().from('settings').select('key, value').throwOnError()
  const get = (k: string) => data.find((r) => r.key === k)?.value
  const bank = get('bank_info')
  const bankObj = bank && typeof bank === 'object' && !Array.isArray(bank) ? (bank as Record<string, unknown>) : {}
  const values: SettingsValues = {
    store_name: str(get('store_name')),
    // Dạng cũ là chuỗi tự do: đưa vào ô "Ngân hàng" để không mất khi lưu lại.
    bank: typeof bank === 'string' ? bank : str(bankObj.bank ?? bankObj.bank_name),
    account: str(bankObj.account ?? bankObj.account_number),
    holder: str(bankObj.holder ?? bankObj.account_name),
    notify_email: str(get('notify_email')),
    telegram_chat_id: str(get('telegram_chat_id')),
    zalo_link: str(get('zalo_link')),
    min_payout: str(get('min_payout') ?? DEFAULT_MIN_PAYOUT),
  }
  return (
    <>
      <SettingsForm values={values} defaultStoreName={SITE_NAME} />
      <Card as="section" className="flex flex-col gap-3 p-5">
        <h2 className="text-xl font-bold tracking-tight">Sao lưu</h2>
        <p className="text-stone-700">Tải file Excel chứa toàn bộ dữ liệu chính (mỗi bảng một trang tính).</p>
        <a href="/admin/xuat-du-lieu?loai=tat-ca" download className={buttonClass({ variant: 'secondary', className: 'self-start' })}>
          <Download aria-hidden className="size-5" />Xuất toàn bộ dữ liệu
        </a>
      </Card>
    </>
  )
}

export default function SettingsPage() {
  return (
    <AdminMain width="narrow">
      <PageHeader title="Cài đặt" subtitle="Thông tin cửa hàng, tài khoản nhận tiền và kênh nhận thông báo đơn mới." />
      <Suspense fallback={<Loading />}>
        <Settings />
      </Suspense>
    </AdminMain>
  )
}
