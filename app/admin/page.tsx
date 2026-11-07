import Link from 'next/link'
import { Suspense } from 'react'
import { dashboardStats } from '@/lib/admin/orders-actions'
import { requireStaff } from '@/lib/auth/guards'
import { formatVnd, vnDateInput, vnDayStart } from '@/lib/format'
import { SITE_NAME } from '@/lib/site'

export const metadata = { title: `Tổng quan — ${SITE_NAME}` }

const input = 'h-11 rounded-lg border border-gray-300 px-3 text-base'
const button = 'flex h-11 items-center rounded-lg bg-green-700 px-4 font-semibold text-white'

function Tile({ href, label, value, hint }: { href: string; label: string; value: string; hint?: string }) {
  return (
    <li>
      <Link href={href} title={hint} className="flex h-full flex-col gap-1 rounded-xl border border-gray-200 p-4">
        <span className="text-gray-700">{label}</span>
        <span className="text-2xl font-bold">{value}</span>
        {hint && <span className="text-sm text-gray-600">{hint}</span>}
      </Link>
    </li>
  )
}

async function Overview() {
  const { role } = await requireStaff()
  const stats = await dashboardStats()
  const today = vnDateInput(new Date())
  const monthStart = `${today.slice(0, 8)}01`
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        <Tile href={`/admin/don-hang?tu=${vnDateInput(vnDayStart(0))}`} label="Đơn mới hôm nay" value={String(stats.newToday)} />
        <Tile href="/admin/don-hang?trang-thai=delivered" label="Đơn chờ thu tiền" value={String(stats.awaitingPayment)} hint="Đã giao, chưa thu đủ tiền" />
        <Tile
          href="/admin/don-hang?trang-thai=paid"
          label="Doanh số tháng"
          value={formatVnd(stats.monthRevenue)}
          hint="Tổng tiền các đơn chuyển sang “Đã thu đủ tiền” trong tháng này (giờ VN), không tính đơn sau đó trả hàng"
        />
        <Tile href="/admin/hoa-hong" label="Hoa hồng chờ chi" value={formatVnd(stats.pendingCommission)} hint="Mọi kỳ, đã trừ dòng âm do trả hàng" />
      </ul>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Xuất dữ liệu</h2>
        <form action="/admin/xuat-du-lieu" method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="loai" value="don-hang" />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-700">Từ ngày</span>
            <input type="date" name="tu" required defaultValue={monthStart} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-700">Đến ngày</span>
            <input type="date" name="den" required defaultValue={today} className={input} />
          </label>
          <button type="submit" className={button}>Xuất đơn hàng (Excel)</button>
        </form>
        <p className="text-sm text-gray-600">Mỗi dòng hàng một hàng, theo ngày tạo đơn (giờ VN), tối đa 366 ngày.</p>
        {role === 'admin' && (
          <p>
            <a href="/admin/xuat-du-lieu?loai=tat-ca" download className="font-semibold text-green-800 underline">
              Xuất toàn bộ dữ liệu (sao lưu)
            </a>
          </p>
        )}
      </section>
    </>
  )
}

export default function AdminHome() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4">
      <h1 className="text-2xl font-bold">Tổng quan</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Overview />
      </Suspense>
    </main>
  )
}
