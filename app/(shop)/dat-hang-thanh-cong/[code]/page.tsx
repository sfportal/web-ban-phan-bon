import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Money } from '@/components/Money'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'

export const metadata = { title: `Đặt hàng thành công — ${SITE_NAME}` }

// Chặn render đến khi có dữ liệu để mã đơn sai trả HTTP 404 thật.
export const instant = false

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const BANK_LABELS: Record<string, string> = {
  bank: 'Ngân hàng',
  bank_name: 'Ngân hàng',
  account: 'Số tài khoản',
  account_number: 'Số tài khoản',
  holder: 'Chủ tài khoản',
  account_name: 'Chủ tài khoản',
  branch: 'Chi nhánh',
}

/** bank_info có thể là chuỗi tự do hoặc object { bank, account, holder, ... }. */
function bankLines(v: unknown): { label: string | null; value: string }[] {
  if (typeof v === 'string') return v.trim() ? [{ label: null, value: v.trim() }] : []
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => (typeof val === 'string' && val.trim()) || typeof val === 'number')
      .map(([k, val]) => ({ label: BANK_LABELS[k] ?? k, value: String(val).trim() }))
  }
  return []
}

export default async function OrderSuccessPage({ params, searchParams }: PageProps<'/dat-hang-thanh-cong/[code]'>) {
  const { code } = await params
  const { id } = await searchParams
  // Mã đơn tăng dần nên đoán được; yêu cầu thêm id (UUID) của đơn để xem trang này.
  if (typeof id !== 'string' || !UUID.test(id) || !/^[A-Z0-9-]{1,32}$/.test(code)) notFound()

  const db = adminClient()
  const { data: order } = await db
    .from('orders').select('code, subtotal, payment_method').eq('id', id).eq('code', code)
    .maybeSingle().throwOnError()
  if (!order) notFound()

  const bank =
    order.payment_method === 'transfer'
      ? bankLines((await db.from('settings').select('value').eq('key', 'bank_info').maybeSingle().throwOnError()).data?.value)
      : []

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 pb-24 text-base">
      <h1 className="text-2xl font-bold text-green-700">Đặt hàng thành công</h1>
      <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
        <p>
          Mã đơn: <span className="text-lg font-bold">{order.code}</span>
        </p>
        <p>
          Tổng tiền: <Money value={Number(order.subtotal)} className="text-lg font-bold text-green-700" />
        </p>
        <p>Thanh toán: {order.payment_method === 'transfer' ? 'Chuyển khoản ngân hàng' : 'Trả tiền khi nhận hàng (COD)'}</p>
      </div>

      {order.payment_method === 'transfer' && (
        <section className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="text-lg font-bold">Thông tin chuyển khoản</h2>
          {bank.length > 0 ? (
            <dl className="flex flex-col gap-1">
              {bank.map(({ label, value }, i) => (
                <div key={i} className="flex flex-wrap gap-x-2">
                  {label && <dt className="text-gray-700">{label}:</dt>}
                  <dd className="whitespace-pre-line font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>Cửa hàng sẽ gửi thông tin tài khoản khi gọi xác nhận đơn.</p>
          )}
          <p>
            Nội dung chuyển khoản: <span className="font-bold">{order.code}</span>
          </p>
        </section>
      )}

      <p className="font-semibold">Cửa hàng sẽ gọi điện xác nhận đơn trong giờ làm việc.</p>
      <Link href="/" className="flex h-12 items-center justify-center rounded-lg bg-green-700 px-5 font-semibold text-white">
        Tiếp tục mua hàng
      </Link>
    </main>
  )
}
