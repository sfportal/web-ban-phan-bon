'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui'
import { saveSettings } from '@/lib/admin/settings-actions'

export type SettingsValues = {
  store_name: string
  bank: string
  account: string
  holder: string
  notify_email: string
  telegram_chat_id: string
  zalo_link: string
}

const input = 'h-11 rounded-xl border border-stone-300 bg-white px-3 text-base'

function Field({ name, label, hint, value, type = 'text', placeholder }: {
  name: keyof SettingsValues; label: string; hint?: string; value: string; type?: string; placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-semibold">{label}</span>
      <input name={name} type={type} defaultValue={value} placeholder={placeholder} className={input} />
      {hint && <span className="text-sm text-stone-600">{hint}</span>}
    </label>
  )
}

export function SettingsForm({ values, defaultStoreName }: { values: SettingsValues; defaultStoreName: string }) {
  const router = useRouter()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        start(async () => {
          try {
            const res = await saveSettings(form)
            setMsg(res.status === 'ok' ? { ok: true, text: 'Đã lưu' } : { ok: false, text: res.message })
            if (res.status === 'ok') router.refresh()
          } catch {
            setMsg({ ok: false, text: 'Không lưu được. Kiểm tra kết nối mạng rồi thử lại.' })
          }
        })
      }}
    >
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-2 text-xl font-bold tracking-tight">Cửa hàng</legend>
          <Field name="store_name" label="Tên cửa hàng" value={values.store_name} placeholder={defaultStoreName} hint={`Để trống sẽ dùng "${defaultStoreName}".`} />
          <Field name="zalo_link" label="Link Zalo" type="url" value={values.zalo_link} placeholder="https://zalo.me/..." hint="Hiện nút “Chat Zalo” trên cửa hàng." />
        </fieldset>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-2 text-xl font-bold tracking-tight">Thông tin chuyển khoản</legend>
          <p className="text-sm text-stone-600">Hiện cho khách chọn chuyển khoản ở trang đặt hàng thành công. Để trống cả ba ô để ẩn.</p>
          <Field name="bank" label="Ngân hàng" value={values.bank} />
          <Field name="account" label="Số tài khoản" value={values.account} />
          <Field name="holder" label="Chủ tài khoản" value={values.holder} />
        </fieldset>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-2 text-xl font-bold tracking-tight">Thông báo đơn mới</legend>
          <Field name="notify_email" label="Email nhận thông báo" type="email" value={values.notify_email} />
          <Field name="telegram_chat_id" label="Telegram chat id" value={values.telegram_chat_id} placeholder="-100…" hint="Bot token đặt ở biến môi trường TELEGRAM_BOT_TOKEN." />
        </fieldset>
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-primary' : 'rounded-xl bg-red-50 p-3 text-red-800'}>{msg.text}</p>}
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? 'Đang lưu…' : 'Lưu cài đặt'}
      </Button>
    </form>
  )
}
