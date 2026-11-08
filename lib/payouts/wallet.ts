import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { DEFAULT_MIN_PAYOUT, type BatchKind, type PayoutSource, type PayoutStatus } from './validate'

// Đọc ví / lịch sử / danh sách chi trả bằng service role. KHÔNG tự kiểm tra quyền: page hoặc
// Server Action gọi requirePartner() (chỉ truyền partnerId của phiên) / requireStaff() trước.

export type Wallet = { earned: number; pendingOut: number; paid: number; available: number }

export type PayoutRow = {
  id: string
  amount: number
  source: PayoutSource
  status: PayoutStatus
  transferRef: string | null
  /** yyyy-mm-dd */
  transferredOn: string | null
  hasProof: boolean
  rejectReason: string | null
  requestedAt: Date
  paidAt: Date | null
}

export type AdminPayoutRow = PayoutRow & {
  partnerId: string
  partnerName: string
  phone: string
  bankName: string | null
  bankAccount: string | null
  bankHolder: string | null
  batchId: string | null
  isDemo: boolean
}

export type BalanceRow = Wallet & { partnerId: string; partnerName: string; phone: string; status: string; isDemo: boolean }

export type BatchRow = {
  id: string
  kind: BatchKind
  cutoffDate: string
  note: string | null
  isDemo: boolean
  createdAt: Date
}

/** Mức rút tối thiểu (setting `min_payout`, số nguyên dương); thiếu / hỏng → 100000. */
export async function getMinPayout(): Promise<number> {
  const { data } = await adminClient().from('settings').select('value').eq('key', 'min_payout').maybeSingle().throwOnError()
  const v = data?.value
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : DEFAULT_MIN_PAYOUT
}

export async function getWallet(partnerId: string): Promise<Wallet> {
  const { data, error } = await adminClient().rpc('partner_wallet', { p_partner_id: partnerId }).single()
  if (error) throw error
  return {
    earned: Number(data.earned), pendingOut: Number(data.pending_out), paid: Number(data.paid), available: Number(data.available),
  }
}

const PAYOUT_COLUMNS =
  'id, amount, source, status, transfer_ref, transferred_on, proof_path, reject_reason, requested_at, paid_at'

type PayoutDbRow = {
  id: string; amount: number; source: PayoutSource; status: PayoutStatus; transfer_ref: string | null
  transferred_on: string | null; proof_path: string | null; reject_reason: string | null
  requested_at: string; paid_at: string | null
}

function toPayoutRow(r: PayoutDbRow): PayoutRow {
  return {
    id: r.id, amount: Number(r.amount), source: r.source, status: r.status, transferRef: r.transfer_ref,
    transferredOn: r.transferred_on, hasProof: !!r.proof_path, rejectReason: r.reject_reason,
    requestedAt: new Date(r.requested_at), paidAt: r.paid_at ? new Date(r.paid_at) : null,
  }
}

/** Lịch sử hoa hồng theo đơn và các khoản chi của đối tác, mới nhất trước. */
export async function getWalletHistory(partnerId: string): Promise<{
  entries: { orderCode: string; amount: number; kind: 'earn' | 'reversal'; createdAt: Date }[]
  payouts: PayoutRow[]
}> {
  const db = adminClient()
  const [entries, payouts] = await Promise.all([
    fetchAll((from, to) =>
      db.from('commission_entries').select('id, kind, amount, created_at, orders(code)').eq('partner_id', partnerId)
        .order('created_at', { ascending: false }).order('id').range(from, to).throwOnError()),
    fetchAll((from, to) =>
      db.from('payouts').select(PAYOUT_COLUMNS).eq('partner_id', partnerId)
        .order('requested_at', { ascending: false }).order('id').range(from, to).throwOnError()),
  ])
  return {
    entries: entries.map((e) => ({
      orderCode: e.orders?.code ?? '', amount: Number(e.amount), kind: e.kind, createdAt: new Date(e.created_at),
    })),
    payouts: payouts.map(toPayoutRow),
  }
}

const ADMIN_PAYOUT_COLUMNS =
  `${PAYOUT_COLUMNS}, partner_id, bank_name, bank_account, bank_holder, batch_id, is_demo, partners(name, phone)`

type AdminPayoutDbRow = PayoutDbRow & {
  partner_id: string; bank_name: string | null; bank_account: string | null; bank_holder: string | null
  batch_id: string | null; is_demo: boolean; partners: { name: string; phone: string } | null
}

function toAdminPayoutRow(r: AdminPayoutDbRow): AdminPayoutRow {
  return {
    ...toPayoutRow(r), partnerId: r.partner_id, partnerName: r.partners?.name ?? '', phone: r.partners?.phone ?? '',
    bankName: r.bank_name, bankAccount: r.bank_account, bankHolder: r.bank_holder, batchId: r.batch_id, isDemo: r.is_demo,
  }
}

/** Yêu cầu rút (source request), lọc trạng thái tùy chọn; mới nhất trước. */
export async function listPayoutRequests(status?: PayoutStatus): Promise<AdminPayoutRow[]> {
  const db = adminClient()
  const rows = await fetchAll<AdminPayoutDbRow>((from, to) => {
    let q = db.from('payouts').select(ADMIN_PAYOUT_COLUMNS).eq('source', 'request')
    if (status) q = q.eq('status', status)
    return q.order('requested_at', { ascending: false }).order('id').range(from, to).throwOnError()
  })
  return rows.map(toAdminPayoutRow)
}

/** Các đợt chi, mới nhất trước. */
export async function listBatches(): Promise<BatchRow[]> {
  const db = adminClient()
  const rows = await fetchAll((from, to) =>
    db.from('payout_batches').select('id, kind, cutoff_date, note, is_demo, created_at')
      .order('created_at', { ascending: false }).order('id').range(from, to).throwOnError())
  return rows.map((b) => ({
    id: b.id, kind: b.kind, cutoffDate: b.cutoff_date, note: b.note, isDemo: b.is_demo, createdAt: new Date(b.created_at),
  }))
}

/** Một đợt chi và các khoản của nó (theo tên CTV); null nếu không có. */
export async function getBatch(batchId: string): Promise<{ batch: BatchRow; payouts: AdminPayoutRow[] } | null> {
  const db = adminClient()
  const { data: b } = await db.from('payout_batches').select('id, kind, cutoff_date, note, is_demo, created_at')
    .eq('id', batchId).maybeSingle().throwOnError()
  if (!b) return null
  const rows = await fetchAll<AdminPayoutDbRow>((from, to) =>
    db.from('payouts').select(ADMIN_PAYOUT_COLUMNS).eq('batch_id', batchId).order('id').range(from, to).throwOnError())
  const payouts = rows.map(toAdminPayoutRow)
    .sort((x, y) => x.partnerName.localeCompare(y.partnerName, 'vi') || x.phone.localeCompare(y.phone))
  return {
    batch: { id: b.id, kind: b.kind, cutoffDate: b.cutoff_date, note: b.note, isDemo: b.is_demo, createdAt: new Date(b.created_at) },
    payouts,
  }
}

/**
 * Số dư ví của mọi CTV (bậc commission), theo tên. Cùng công thức với partner_wallet nhưng
 * tính một lượt (tránh gọi RPC từng người).
 */
export async function listBalances(): Promise<BalanceRow[]> {
  const db = adminClient()
  const [partners, entries, payouts] = await Promise.all([
    fetchAll((from, to) =>
      db.from('partners').select('id, name, phone, status, is_demo, partner_tiers!inner(kind)')
        .eq('partner_tiers.kind', 'commission').order('id').range(from, to).throwOnError()),
    fetchAll((from, to) =>
      db.from('commission_entries').select('id, partner_id, amount').order('id').range(from, to).throwOnError()),
    fetchAll((from, to) =>
      db.from('payouts').select('id, partner_id, amount, status').in('status', ['requested', 'approved', 'paid'])
        .order('id').range(from, to).throwOnError()),
  ])
  const rows = new Map<string, BalanceRow>(partners.map((p) => [p.id, {
    partnerId: p.id, partnerName: p.name, phone: p.phone, status: p.status, isDemo: p.is_demo,
    earned: 0, pendingOut: 0, paid: 0, available: 0,
  }]))
  for (const e of entries) {
    const r = rows.get(e.partner_id)
    if (r) r.earned += Number(e.amount)
  }
  for (const p of payouts) {
    const r = rows.get(p.partner_id)
    if (!r) continue
    if (p.status === 'paid') r.paid += Number(p.amount)
    else r.pendingOut += Number(p.amount)
  }
  for (const r of rows.values()) r.available = r.earned - r.pendingOut - r.paid
  return [...rows.values()].sort((a, b) => a.partnerName.localeCompare(b.partnerName, 'vi') || a.phone.localeCompare(b.phone))
}
