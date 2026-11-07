import { CircleCheck, Landmark } from 'lucide-react'
import { notFound } from 'next/navigation'
import { Money } from '@/components/Money'
import { Button, Card } from '@/components/ui'
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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pb-16 pt-8 text-base md:pt-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary ring-8 ring-primary-soft/40">
          <CircleCheck className="size-9" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Đặt hàng thành công</h1>
        <p className="max-w-sm text-stone-700">Cửa hàng sẽ gọi điện xác nhận đơn trong giờ làm việc.</p>
      </div>

      <Card className="flex flex-col divide-y divide-dashed divide-stone-300">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 p-4">
          Mã đơn: <span className="text-xl font-bold tracking-wide text-ink">{order.code}</span>
        </p>
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 p-4">
          Tổng tiền: <Money value={Number(order.subtotal)} className="text-xl font-bold tabular-nums text-primary" />
        </p>
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 p-4">
          Thanh toán: <span className="font-semibold">{order.payment_method === 'transfer' ? 'Chuyển khoản ngân hàng' : 'Trả tiền khi nhận hàng (COD)'}</span>
        </p>
      </Card>

      {order.payment_method === 'transfer' && (
        <section className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-accent-soft p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Landmark aria-hidden className="size-5 text-accent" />
            Thông tin chuyển khoản
          </h2>
          {bank.length > 0 ? (
            <dl className="flex flex-col gap-1">
              {bank.map(({ label, value }, i) => (
                <div key={i} className="flex flex-wrap gap-x-2">
                  {label && <dt className="text-stone-700">{label}:</dt>}
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

      <Button href="/" size="lg" className="w-full">
        Tiếp tục mua hàng
      </Button>
    </main>
  )
}
