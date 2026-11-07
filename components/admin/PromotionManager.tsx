'use client'

import { Percent } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Badge, EmptyState, type BadgeTone } from '@/components/ui'
import { deletePromotion, savePromotion } from '@/lib/admin/promotions-actions'

export type PromoRow = {
  id: string; name: string; scope: 'product' | 'category'; targetId: string; targetLabel: string
  type: 'percent' | 'fixed_price'; value: number; startDate: string; endDate: string; isActive: boolean; statusLabel: string
}
type Opt = { id: string; name: string }
const STATUS_TONE: Record<string, BadgeTone> = { 'Đang chạy': 'green', 'Sắp diễn ra': 'blue', 'Đã kết thúc': 'gray', 'Đang tắt': 'gray' }
const input = 'h-11 rounded-xl border border-stone-300 bg-white px-3 text-base'

function valueLabel(p: Pick<PromoRow, 'type' | 'value'>) {
  return p.type === 'percent' ? `Giảm ${p.value}%` : `Giá ${new Intl.NumberFormat('vi-VN').format(p.value)} đ`
}

export function PromotionManager({
  promotions, products, categories, today, readOnly,
}: { promotions: PromoRow[]; products: Opt[]; categories: Opt[]; today: string; readOnly: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<PromoRow | null>(null)
  const [scope, setScope] = useState<'product' | 'category'>('category')
  const [type, setType] = useState<'percent' | 'fixed_price'>('percent')
  const [formKey, setFormKey] = useState(0)

  const begin = (p: PromoRow | null) => {
    setEditing(p)
    setScope(p?.scope ?? 'category')
    setType(p?.type ?? 'percent')
    setError('')
    setFormKey((k) => k + 1)
  }
  const targets = scope === 'product' ? products : categories

  return (
    <div className="flex flex-col gap-4">
      {promotions.length === 0
        ? <EmptyState icon={<Percent className="size-7" />} title="Chưa có khuyến mãi nào" className="rounded-2xl border border-stone-200 bg-white" />
        : (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {promotions.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 px-4 py-3 even:bg-stone-50/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b>{p.name}</b>
                  <Badge tone={STATUS_TONE[p.statusLabel] ?? 'gray'}>{p.statusLabel}</Badge>
                </div>
                <span>{p.scope === 'product' ? 'Sản phẩm' : 'Nhóm'}: {p.targetLabel} · {valueLabel(p)}</span>
                <span className="text-sm text-stone-600">{p.startDate} đến {p.endDate}</span>
                {!readOnly && (
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => begin(p)} className="h-11 rounded-xl border border-primary/25 bg-white px-4 font-semibold text-primary hover:bg-primary-soft">Sửa</button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Xóa khuyến mãi “${p.name}”?`)) return
                        start(async () => { await deletePromotion(p.id); router.refresh() })
                      }}
                      className="h-11 rounded-xl border border-red-300 bg-white px-4 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      Xóa
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      {!readOnly && (
        <form
          key={formKey}
          className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            start(async () => {
              const res = await savePromotion(form)
              if (res.status === 'invalid') { setError(res.message); return }
              begin(null)
              router.refresh()
            })
          }}
        >
          <h2 className="text-lg font-bold">{editing ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi'}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input name="name" defaultValue={editing?.name} required placeholder="Tên khuyến mãi" aria-label="Tên khuyến mãi" className={input} />
          <div className="flex flex-wrap gap-2">
            <select name="scope" value={scope} onChange={(e) => { const s = e.target.value as 'product' | 'category'; setScope(s); if (s === 'category') setType('percent') }} aria-label="Phạm vi" className={input}>
              <option value="category">Theo nhóm</option>
              <option value="product">Theo sản phẩm</option>
            </select>
            <select key={scope} name="targetId" defaultValue={editing?.scope === scope ? editing.targetId : ''} required aria-label="Áp dụng cho" className={`${input} min-w-0 flex-1`}>
              <option value="" disabled>{scope === 'product' ? 'Chọn sản phẩm' : 'Chọn nhóm'}</option>
              {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <select name="type" value={type} onChange={(e) => setType(e.target.value as 'percent' | 'fixed_price')} aria-label="Loại" className={input}>
              <option value="percent">Giảm %</option>
              {scope === 'product' && <option value="fixed_price">Giá cố định</option>}
            </select>
            <input name="value" defaultValue={editing?.value} required inputMode="decimal" placeholder={type === 'percent' ? '% giảm' : 'Giá (đ)'} aria-label="Giá trị" className={`${input} w-32`} />
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col text-sm text-stone-600">Từ ngày
              <input type="date" name="startDate" defaultValue={editing?.startDate ?? today} required className={input} />
            </label>
            <label className="flex flex-col text-sm text-stone-600">Đến hết ngày
              <input type="date" name="endDate" defaultValue={editing?.endDate ?? today} required className={input} />
            </label>
          </div>
          <label className="flex h-11 items-center gap-2">
            <input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} className="size-5 accent-primary" /> Đang bật
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="h-11 rounded-xl bg-primary px-4 font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60">Lưu</button>
            {editing && <button type="button" onClick={() => begin(null)} className="h-11 rounded-xl border border-stone-300 px-4 font-semibold">Hủy</button>}
          </div>
          {error && <p role="alert" className="text-red-700">{error}</p>}
        </form>
      )}
    </div>
  )
}
