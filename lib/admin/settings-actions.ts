'use server'
// Server Actions cài đặt cửa hàng và sao lưu (xuất toàn bộ dữ liệu). Chỉ admin.
// Dạng giá trị lưu khớp với nơi đọc: store_name/notify_email/telegram_chat_id/zalo_link là
// chuỗi; bank_info là object { bank, account, holder } (trang đặt hàng thành công).
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { requireStaff } from '@/lib/auth/guards'
import { ALL_DATA_SHEETS, buildTablesWorkbook } from '@/lib/excel/export'
import { adminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'
import { fetchAll } from '@/lib/supabase/fetch-all'

export type SettingsResult = { status: 'ok' } | { status: 'invalid'; message: string }

const text = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự`)
const schema = z.object({
  store_name: text(120),
  bank: text(120),
  account: text(60),
  holder: text(120),
  notify_email: z.string().trim().max(200).pipe(z.union([z.literal(''), z.email('Email nhận thông báo không hợp lệ')])),
  telegram_chat_id: z.string().trim().pipe(z.union([z.literal(''), z.string().regex(/^(-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/, 'Telegram chat id là số (vd -100123…) hoặc @tên_kênh')])),
  zalo_link: z.string().trim().max(300).pipe(z.union([z.literal(''), z.string().regex(/^https?:\/\/\S+$/i, 'Link Zalo phải bắt đầu bằng http:// hoặc https://')])),
})

const BANK_FORM_KEYS = new Set(['bank', 'bank_name', 'account', 'account_number', 'holder', 'account_name'])

export async function saveSettings(form: FormData): Promise<SettingsResult> {
  await requireStaff('admin')
  const raw = Object.fromEntries(Object.keys(schema.shape).map((k) => [k, String(form.get(k) ?? '')]))
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { status: 'invalid', message: parsed.error.issues[0].message }
  const v = parsed.data

  const db = adminClient()
  // Giữ các khóa bank_info khác mà form không có (vd `branch`); khóa form và tên cũ tương đương thì thay.
  const { data: prev } = await db.from('settings').select('value').eq('key', 'bank_info').maybeSingle().throwOnError()
  const kept = prev?.value && typeof prev.value === 'object' && !Array.isArray(prev.value)
    ? Object.fromEntries(Object.entries(prev.value).filter(([k]) => !BANK_FORM_KEYS.has(k)))
    : {}
  const bank = {
    ...Object.fromEntries(
      ([['bank', v.bank], ['account', v.account], ['holder', v.holder]] as const).filter(([, x]) => x !== ''),
    ),
    ...kept,
  }
  const values: Record<string, Json | null> = {
    store_name: v.store_name || null,
    // Cả ba ô trống → ẩn thông tin chuyển khoản (xóa khóa, kể cả khóa phụ như branch).
    bank_info: v.bank || v.account || v.holder ? bank : null,
    notify_email: v.notify_email || null,
    telegram_chat_id: v.telegram_chat_id || null,
    zalo_link: v.zalo_link || null,
  }
  const upserts = Object.entries(values).filter(([, x]) => x !== null).map(([key, value]) => ({ key, value: value! }))
  const deletes = Object.entries(values).filter(([, x]) => x === null).map(([key]) => key)
  if (upserts.length) await db.from('settings').upsert(upserts).throwOnError()
  if (deletes.length) await db.from('settings').delete().in('key', deletes).throwOnError()
  return { status: 'ok' }
}

/** Sao lưu: mỗi bảng chính một sheet (xem ALL_DATA_SHEETS). */
export async function exportAll(): Promise<Buffer> {
  await requireStaff('admin')
  // Tên bảng lấy từ danh mục cố định trong code, không từ người dùng.
  const db = adminClient() as unknown as SupabaseClient
  const sheets = []
  for (const s of ALL_DATA_SHEETS) {
    const rows = await fetchAll<Record<string, unknown>>((from, to) => {
      let q = db.from(s.table).select(s.columns.map((c) => c.key).join(', '))
      for (const c of s.order) q = q.order(c)
      return q.range(from, to).throwOnError() as unknown as PromiseLike<{ data: Record<string, unknown>[] | null }>
    })
    sheets.push({ name: s.name, columns: s.columns, rows })
  }
  return buildTablesWorkbook(sheets)
}
