'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Card, Field, Input, SectionHeader } from '@/components/ui'
import { createDemoData, deleteDemoData, type DemoSummary } from '@/lib/admin/demo-data'

const ERRORS = {
  weak_password: 'Mật khẩu cần ít nhất 8 ký tự.',
  already_exists: 'Đã có dữ liệu thử. Hãy xóa dữ liệu thử trước khi tạo lại.',
  phone_taken: 'Một trong các số 0900000101–0900000105 (hoặc số nông dân thử) đã được dùng bởi dữ liệu thật.',
} as const
const NETWORK = 'Không thực hiện được. Kiểm tra kết nối mạng rồi thử lại.'

/** Tạo / xóa dữ liệu thử. Xóa cần bấm xác nhận ngay trên trang (không dùng hộp thoại của trình duyệt). */
export function DemoDataPanel({ exists }: { exists: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const password = String(new FormData(form).get('password') ?? '')
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const res = await createDemoData({ password })
      if ('error' in res) setError(ERRORS[res.error])
      else {
        form.reset()
        setNotice(summaryText(res.summary))
        router.refresh()
      }
    } catch {
      setError(NETWORK)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const res = await deleteDemoData()
      setConfirming(false)
      setNotice(`Đã xóa ${res.deleted.partners ?? 0} đối tác, ${res.deleted.farmers ?? 0} nông dân, ${res.deleted.orders ?? 0} đơn và ${res.deleted.payouts ?? 0} khoản chi thử.`)
      router.refresh()
    } catch {
      setError(NETWORK)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 font-semibold text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-primary-soft p-3 text-primary-hover">{notice}</p>}

      {!exists ? (
        <Card as="section" className="flex flex-col gap-4 p-5">
          <SectionHeader
            title="Tạo dữ liệu thử"
            subtitle="3 CTV và 1 đại lý đang hoạt động, 1 CTV chờ duyệt (số 0900000101–0900000105), nông dân, đơn đủ trạng thái, yêu cầu rút và đợt chi. Dùng để tập xử lý đơn và chi trả; xóa sạch được bằng một nút."
          />
          <form onSubmit={create} className="flex max-w-md flex-col gap-4">
            <Field label="Mật khẩu chung cho 5 tài khoản thử" hint="Ít nhất 8 ký tự. Hệ thống không lưu lại mật khẩu này, hãy tự ghi nhớ.">
              <Input type="password" name="password" autoComplete="new-password" minLength={8} required />
            </Field>
            <div>
              <Button type="submit" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo dữ liệu thử'}</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card as="section" className="flex flex-col gap-4 p-5">
          <SectionHeader
            title="Xóa dữ liệu thử"
            subtitle="Xóa toàn bộ đối tác, nông dân, đơn, khoản chi, đợt chi thử và tài khoản đăng nhập của đối tác thử. Dữ liệu thật không bị đụng tới."
          />
          {!confirming ? (
            <div>
              <Button variant="secondary" onClick={() => setConfirming(true)}>Xóa toàn bộ dữ liệu thử</Button>
            </div>
          ) : (
            <div role="group" aria-label="Xác nhận xóa dữ liệu thử" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-red-800">Xóa toàn bộ dữ liệu thử? Không hoàn tác được.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="danger" onClick={remove} disabled={busy}>{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button>
                <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Hủy</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function summaryText(s: DemoSummary): string {
  return `Đã tạo ${s.partners} đối tác, ${s.farmers} nông dân, ${s.orders} đơn và ${s.payouts} khoản chi thử.`
}
