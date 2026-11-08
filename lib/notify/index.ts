import 'server-only'
import { formatVnd } from '@/lib/format'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'

export type NewOrderNotice = {
  code: string
  source: 'partner' | 'retail'
  partnerName: string | null
  subtotal: number
  /** Tiền đại lý phải trả (đơn đại lý); null với đơn khác. */
  partnerPayable: number | null
}

const DEFAULT_FROM = 'onboarding@resend.dev'

/** Chuỗi khác rỗng từ giá trị jsonb (chat id Telegram có thể lưu dạng số). */
function settingText(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

async function loadSettings(keys: string[]): Promise<Record<string, string | null>> {
  const { data, error } = await adminClient().from('settings').select('key, value').in('key', keys)
  if (error) throw error
  return Object.fromEntries(keys.map((k) => [k, settingText(data.find((r) => r.key === k)?.value)]))
}

function message(o: NewOrderNotice): { subject: string; text: string } {
  const who = o.source === 'partner' ? `Đối tác: ${o.partnerName ?? '—'}` : `Đơn lẻ${o.partnerName ? ` (khách của ${o.partnerName})` : ''}`
  return {
    subject: `[${SITE_NAME}] Đơn mới ${o.code}`,
    text: [`Đơn mới ${o.code}`, who, `Tổng tiền: ${formatVnd(o.partnerPayable ?? o.subtotal)}`].join('\n'),
  }
}

async function post(label: string, url: string, init: RequestInit): Promise<void> {
  try {
    const res = await fetch(url, init)
    if (!res.ok) console.error(`notify ${label}: HTTP ${res.status}`, await res.text().catch(() => ''))
  } catch (e) {
    console.error(`notify ${label}: lỗi gửi`, e)
  }
}

/**
 * Gửi `subject`/`text` cho cửa hàng: email (Resend) nếu có `RESEND_API_KEY` + setting
 * `notify_email`, Telegram nếu có `TELEGRAM_BOT_TOKEN` + setting `telegram_chat_id`.
 * Không bao giờ throw: mọi lỗi chỉ `console.error`.
 */
async function send({ subject, text }: { subject: string; text: string }): Promise<void> {
  try {
    const resendKey = process.env.RESEND_API_KEY?.trim()
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
    if (!resendKey && !botToken) return

    const settings = await loadSettings(['notify_email', 'telegram_chat_id'])
    const jobs: Promise<void>[] = []

    if (resendKey && settings.notify_email) {
      jobs.push(
        post('email', 'https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.NOTIFY_FROM_EMAIL?.trim() || DEFAULT_FROM,
            to: [settings.notify_email],
            subject,
            text,
          }),
        }),
      )
    }
    if (botToken && settings.telegram_chat_id) {
      jobs.push(
        post('telegram', `https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: settings.telegram_chat_id, text }),
        }),
      )
    }
    await Promise.all(jobs)
  } catch (e) {
    console.error('notify: lỗi', e)
  }
}

/** Báo đơn mới cho cửa hàng (xem send). Gọi trong `after()` để không chặn phản hồi gửi đơn. */
export async function notifyNewOrder(order: NewOrderNotice): Promise<void> {
  await send(message(order))
}

export type PayoutRequestNotice = {
  partnerName: string
  phone: string
  amount: number
  bankName: string | null
  bankAccount: string | null
  bankHolder: string | null
}

/** Báo admin có yêu cầu rút tiền mới (cùng kênh với đơn mới). Gọi trong `after()`. */
export async function notifyPayoutRequest(p: PayoutRequestNotice): Promise<void> {
  const amount = formatVnd(p.amount)
  await send({
    subject: `[${SITE_NAME}] Yêu cầu rút tiền ${amount}`,
    text: [
      `Yêu cầu rút tiền ${amount}`,
      `CTV: ${p.partnerName} (${p.phone})`,
      `Ngân hàng: ${[p.bankName, p.bankAccount, p.bankHolder].filter(Boolean).join(' · ') || '—'}`,
      'Duyệt tại trang Chi trả của admin.',
    ].join('\n'),
  })
}
