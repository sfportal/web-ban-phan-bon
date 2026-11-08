import { ClipboardList, Download, HandCoins, TrendingUp, Wallet } from 'lucide-react'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { Button, Card, Input, SectionHeader, StatCard } from '@/components/ui'
import { dashboardStats } from '@/lib/admin/orders-actions'
import { requireStaff } from '@/lib/auth/guards'
import { formatVnd, vnDateInput, vnDayStart } from '@/lib/format'
import { SITE_NAME } from '@/lib/site'

export const metadata = { title: `Tổng quan — ${SITE_NAME}` }

function Tile({ href, label, value, hint, icon }: { href: string; label: string; value: string; hint?: string; icon: ReactNode }) {
  return (
    <li>
      <Link href={href} title={hint} className="group block h-full rounded-2xl">
        <StatCard label={label} value={value} hint={hint} icon={icon} className="h-full transition-colors group-hover:border-primary/40" />
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
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          href={`/admin/don-hang?tu=${vnDateInput(vnDayStart(0))}`}
          label="Đơn mới hôm nay"
          value={String(stats.newToday)}
          icon={<ClipboardList className="size-5" />}
        />
        <Tile
          href="/admin/don-hang?trang-thai=delivered"
          label="Đơn chờ thu tiền"
          value={String(stats.awaitingPayment)}
          hint="Đã giao, chưa thu đủ tiền"
          icon={<HandCoins className="size-5" />}
        />
        <Tile
          href="/admin/don-hang?trang-thai=paid"
          label="Doanh số tháng"
          value={formatVnd(stats.monthRevenue)}
          hint="Tổng tiền các đơn chuyển sang “Đã thu đủ tiền” trong tháng này (giờ VN), không tính đơn sau đó trả hàng"
          icon={<TrendingUp className="size-5" />}
        />
        <Tile
          href="/admin/hoa-hong"
          label="Hoa hồng chờ chi"
          value={formatVnd(stats.pendingCommission)}
          hint="Hoa hồng đã ghi nhận trừ các khoản đã chuyển, đã trừ dòng âm do trả hàng"
          icon={<Wallet className="size-5" />}
        />
      </ul>

      <Card as="section" className="flex flex-col gap-4 p-5">
        <SectionHeader title="Xuất dữ liệu" subtitle="Mỗi dòng hàng một hàng, theo ngày tạo đơn (giờ VN), tối đa 366 ngày." />
        <form action="/admin/xuat-du-lieu" method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="loai" value="don-hang" />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-700">Từ ngày</span>
            <Input type="date" name="tu" required defaultValue={monthStart} className="w-auto" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-700">Đến ngày</span>
            <Input type="date" name="den" required defaultValue={today} className="w-auto" />
          </label>
          <Button type="submit"><Download aria-hidden className="size-5" />Xuất đơn hàng (Excel)</Button>
        </form>
        {role === 'admin' && (
          <p className="border-t border-stone-100 pt-3">
            <a href="/admin/xuat-du-lieu?loai=tat-ca" download className="font-semibold text-primary underline underline-offset-4 hover:text-primary-hover">
              Xuất toàn bộ dữ liệu (sao lưu)
            </a>
          </p>
        )}
      </Card>
    </>
  )
}

export default function AdminHome() {
  return (
    <AdminMain>
      <PageHeader title="Tổng quan" subtitle="Số liệu bán hàng hôm nay và trong tháng. Bấm vào từng ô để xem danh sách." />
      <Suspense fallback={<Loading />}>
        <Overview />
      </Suspense>
    </AdminMain>
  )
}
