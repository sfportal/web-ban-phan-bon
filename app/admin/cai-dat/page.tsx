import { Suspense } from 'react'
import { SettingsForm, type SettingsValues } from '@/components/admin/SettingsForm'
import { requireStaff } from '@/lib/auth/guards'
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
  }
  return (
    <>
      <SettingsForm values={values} defaultStoreName={SITE_NAME} />
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">Sao lưu</h2>
        <p className="text-gray-700">Tải file Excel chứa toàn bộ dữ liệu chính (mỗi bảng một trang tính).</p>
        <a href="/admin/xuat-du-lieu?loai=tat-ca" download className="flex h-11 items-center self-start rounded-lg border border-green-700 px-4 font-semibold text-green-800">
          Xuất toàn bộ dữ liệu
        </a>
      </section>
    </>
  )
}

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4">
      <h1 className="text-2xl font-bold">Cài đặt</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Settings />
      </Suspense>
    </main>
  )
}
