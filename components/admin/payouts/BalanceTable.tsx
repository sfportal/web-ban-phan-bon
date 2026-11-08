import { Download, Wallet } from 'lucide-react'
import Link from 'next/link'
import { TableCard, tbody, th as thBase, thead } from '@/components/admin/table'
import { Money } from '@/components/Money'
import { Badge, buttonClass, Card, EmptyState } from '@/components/ui'
import type { BalanceRow } from '@/lib/payouts/wallet'

const th = `${thBase} text-right`
const td = 'px-4 py-3 text-right tabular-nums whitespace-nowrap'

/** Tab "Số dư": ví của mọi CTV (đã kiếm, đang chờ chi, đã nhận, khả dụng). */
export function BalanceTable({ rows, canAct }: { rows: BalanceRow[]; canAct: boolean }) {
  const sum = (k: 'earned' | 'pendingOut' | 'paid' | 'available') => rows.reduce((s, r) => s + r[k], 0)
  return (
    <div className="flex flex-col gap-4">
      {canAct && (
        <a href="/admin/xuat-du-lieu?loai=so-du" download className={buttonClass({ variant: 'secondary', className: 'self-start' })}>
          <Download aria-hidden className="size-5" />Xuất Excel
        </a>
      )}
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Wallet className="size-7" />} title="Chưa có CTV nào" description="Cộng tác viên hưởng hoa hồng sẽ hiện ở đây cùng số dư ví." />
        </Card>
      ) : (
        <TableCard>
          <table className="w-full min-w-[44rem] text-left">
            <thead className={thead}>
              <tr>
                <th className={`${thBase}`}>CTV</th><th className={th}>Đã kiếm</th><th className={th}>Đang chờ chi</th>
                <th className={th}>Đã nhận</th><th className={th}>Khả dụng</th>
              </tr>
            </thead>
            <tbody className={tbody}>
              {rows.map((r) => (
                <tr key={r.partnerId}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/doi-tac/${r.partnerId}`} className="font-semibold text-primary underline-offset-4 hover:underline">{r.partnerName}</Link>
                    {r.isDemo && <Badge tone="gray" className="ml-2">Thử</Badge>}
                    <span className="block text-sm text-stone-600">{r.phone}</span>
                  </td>
                  <td className={td}><Money value={r.earned} /></td>
                  <td className={`${td} ${r.pendingOut ? 'font-semibold text-yellow-900' : 'text-stone-500'}`}><Money value={r.pendingOut} /></td>
                  <td className={td}><Money value={r.paid} /></td>
                  <td className={`${td} font-semibold`}><Money value={r.available} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-stone-200 bg-primary-soft/50 font-bold">
              <tr>
                <td className="px-4 py-3">Tổng</td>
                <td className={td}><Money value={sum('earned')} /></td>
                <td className={td}><Money value={sum('pendingOut')} /></td>
                <td className={td}><Money value={sum('paid')} /></td>
                <td className={td}><Money value={sum('available')} /></td>
              </tr>
            </tfoot>
          </table>
        </TableCard>
      )}
    </div>
  )
}
