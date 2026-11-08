import { PiggyBank, TriangleAlert, Wallet } from 'lucide-react'
import { Suspense } from 'react'
import { Money } from '@/components/Money'
import { Card, EmptyState, SectionHeader, StatCard } from '@/components/ui'
import { requirePartner, type PartnerSession } from '@/lib/auth/guards'
import { formatDate, formatVnd, vnPeriod } from '@/lib/format'
import { getMinPayout, getWallet, getWalletHistory } from '@/lib/payouts/wallet'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { createServerClient } from '@/lib/supabase/server'
import { BankInfoForm } from './BankInfoForm'
import { PayoutList } from './PayoutList'
import { WithdrawForm } from './WithdrawForm'

export const metadata = { title: `Ví / Tiết kiệm — ${SITE_NAME}` }

/** "2026-11" → "Tháng 11/2026" */
function periodLabel(p: string): string {
  const [y, m] = p.split('-')
  return `Tháng ${m}/${y}`
}

/** CTV: ví hoa hồng — số dư, rút tiền, lịch sử hoa hồng theo đơn và các khoản chi. */
async function WalletView({ session }: { session: PartnerSession }) {
  const [wallet, history, min, { data: bank }] = await Promise.all([
    getWallet(session.partnerId),
    getWalletHistory(session.partnerId),
    getMinPayout(),
    adminClient().from('partners').select('bank_name, bank_account, bank_holder').eq('id', session.partnerId).single(),
  ])
  const hasBank = !!(bank?.bank_name && bank.bank_account && bank.bank_holder)

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Đã kiếm được" value={<Money value={wallet.earned} />} />
        <StatCard label="Đang chờ chi" value={<Money value={wallet.pendingOut} />} />
        <StatCard label="Đã nhận" value={<Money value={wallet.paid} />} />
        <StatCard label="Số dư khả dụng" value={<Money value={wallet.available} />} />
      </div>

      {wallet.available < 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-800">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          Số dư đang âm do đơn trả hàng. Khoản này sẽ được trừ vào hoa hồng các đơn sau.
        </p>
      )}

      <BankInfoForm
        initial={hasBank ? { bankName: bank!.bank_name!, bankAccount: bank!.bank_account!, bankHolder: bank!.bank_holder! } : null}
      />
      {hasBank && <WithdrawForm available={wallet.available} min={min} />}

      <section aria-labelledby="payouts" className="flex flex-col gap-3">
        <SectionHeader title={<span id="payouts">Khoản chi</span>} />
        <PayoutList payouts={history.payouts} />
      </section>

      <section aria-labelledby="entries" className="flex flex-col gap-3">
        <SectionHeader title={<span id="entries">Lịch sử hoa hồng</span>} />
        {history.entries.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Wallet className="size-7" />}
              title="Chưa có hoa hồng."
              description="Hoa hồng được ghi khi đơn của bạn đã thu đủ tiền."
            />
          </Card>
        ) : (
          <Card as="div" className="overflow-hidden">
            <ul className="divide-y divide-stone-100">
              {history.entries.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{e.orderCode || '—'}</span>
                    <span className="text-sm text-stone-600">
                      {e.kind === 'reversal' ? 'Trả hàng · ' : ''}{formatDate(e.createdAt)}
                    </span>
                  </span>
                  <span className={`shrink-0 font-bold tabular-nums ${e.amount < 0 ? 'text-red-700' : 'text-primary'}`}>
                    {e.amount < 0 ? '' : '+'}{formatVnd(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </>
  )
}

/** Đại lý: tổng tiết kiệm (giá bán lẻ − giá đại lý) theo tháng đặt đơn (giờ VN), bỏ đơn hủy / trả hàng. */
async function Savings({ session }: { session: PartnerSession }) {
  const db = createServerClient()
  const orders = await fetchAll((from, to) =>
    db.from('orders').select('created_at, subtotal, partner_payable')
      .eq('partner_id', session.partnerId).not('status', 'in', '(cancelled,returned)').not('partner_payable', 'is', null)
      .order('id').range(from, to).throwOnError(),
  )
  const months = new Map<string, { saved: number; count: number }>()
  for (const o of orders) {
    const p = vnPeriod(o.created_at)
    const m = months.get(p) ?? { saved: 0, count: 0 }
    m.saved += Number(o.subtotal) - Number(o.partner_payable)
    m.count += 1
    months.set(p, m)
  }
  const rows = [...months].sort(([a], [b]) => b.localeCompare(a))
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<PiggyBank className="size-7" />}
          title="Chưa có đơn nào."
          description="Mỗi đơn đặt theo giá đại lý sẽ cộng phần tiết kiệm vào tháng đặt đơn."
        />
      </Card>
    )
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map(([p, m]) => (
        <li key={p}>
          <Card className="flex items-center gap-3 p-4">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <PiggyBank className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{periodLabel(p)}</span>
              <span className="text-sm text-stone-600">{m.count} đơn</span>
            </span>
            <Money value={m.saved} className="shrink-0 text-lg font-bold tabular-nums text-primary" />
          </Card>
        </li>
      ))}
    </ul>
  )
}

async function Content() {
  const session = await requirePartner()
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink">{session.kind === 'commission' ? 'Ví hoa hồng' : 'Tiết kiệm theo tháng'}</h1>
      {session.kind === 'commission' ? <WalletView session={session} /> : <Savings session={session} />}
    </>
  )
}

export default function CommissionPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pb-8 pt-5 text-base">
      <Suspense fallback={<p className="py-8 text-center text-stone-600">Đang tải...</p>}>
        <Content />
      </Suspense>
    </main>
  )
}
