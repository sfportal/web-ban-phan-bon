'use client'

import { ChevronRight, Search, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Badge } from '@/components/ui'
import { addFarmer, searchMyFarmers, type AddFarmerResult, type FarmerSummary } from '@/lib/farmers/actions'

const field = 'h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base font-normal text-ink'
const labelCls = 'flex flex-col gap-1.5 font-semibold text-ink'
const OFFLINE = 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'

const ADD_ERRORS: Record<Exclude<AddFarmerResult['status'], 'ok'>, string> = {
  owned_by_other: 'Khách này đã thuộc CTV khác, vui lòng liên hệ cửa hàng',
  invalid_phone: 'Số điện thoại không hợp lệ.',
  missing_fields: 'Vui lòng nhập tên và số điện thoại.',
  not_allowed: 'Tài khoản của bạn không thêm được nông dân.',
}

/** Bước 1 (CTV): chọn nông dân trong danh sách của mình hoặc "Thêm nhanh". */
export function FarmerPicker({
  chosenIds,
  onPick,
  onCancel,
}: {
  chosenIds: (string | null)[]
  onPick: (farmer: FarmerSummary) => void
  onCancel?: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FarmerSummary[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const latest = useRef(0)

  // Tìm (trễ 250ms sau lần gõ cuối); chỉ nhận kết quả của lần tìm mới nhất.
  useEffect(() => {
    const id = ++latest.current
    const t = setTimeout(async () => {
      try {
        const found = await searchMyFarmers(query)
        if (id !== latest.current) return
        setResults(found)
        setSearchError(null)
      } catch {
        if (id === latest.current) setSearchError(OFFLINE)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    const form = new FormData(e.currentTarget)
    const text = (k: string) => String(form.get(k) ?? '')
    setAddError(null)
    startTransition(async () => {
      try {
        const res = await addFarmer({ name: text('name'), phone: text('phone'), address: text('address') })
        if (res.status === 'ok') onPick(res.farmer)
        else setAddError(ADD_ERRORS[res.status])
      } catch {
        setAddError(OFFLINE)
      }
    })
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="farmer-step">
      <div className="flex items-center justify-between gap-2">
        <h1 id="farmer-step" className="text-2xl font-bold tracking-tight text-ink">Chọn nông dân</h1>
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-11 px-2 font-semibold text-primary">
            Quay lại
          </button>
        )}
      </div>

      {adding ? (
        <form onSubmit={onAdd} className="flex flex-col gap-3 rounded-2xl border-2 border-primary/40 bg-white p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <UserPlus aria-hidden className="size-5 text-primary" />
            Thêm nhanh nông dân
          </h2>
          <label className={labelCls}>
            Họ tên
            <input name="name" required autoComplete="off" className={field} />
          </label>
          <label className={labelCls}>
            Số điện thoại
            <input name="phone" required type="tel" inputMode="tel" autoComplete="off" className={field} />
          </label>
          <label className={labelCls}>
            Địa chỉ (không bắt buộc)
            <input name="address" autoComplete="off" className={field} />
          </label>
          {addError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-800">
              {addError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="h-12 flex-1 rounded-xl bg-primary font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {pending ? 'Đang lưu...' : 'Lưu và chọn'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setAddError(null)
              }}
              className="h-12 rounded-xl border border-stone-300 bg-white px-4 font-semibold text-stone-800 hover:bg-stone-50"
            >
              Hủy
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-12 rounded-xl border-2 border-dashed border-primary/60 bg-white font-semibold text-primary transition-colors hover:bg-primary-soft"
        >
          + Thêm nhanh nông dân
        </button>
      )}

      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-stone-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên hoặc SĐT..."
          aria-label="Tìm nông dân"
          className="h-12 w-full rounded-xl border border-stone-300 bg-white pl-11 pr-3 text-base text-ink placeholder:text-stone-400"
        />
      </div>
      {searchError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-800">
          {searchError}
        </p>
      )}
      {results === null ? (
        !searchError && <p className="py-4 text-center text-stone-600">Đang tải...</p>
      ) : results.length === 0 ? (
        <p className="py-4 text-center text-stone-600">
          {query.trim() ? 'Không tìm thấy nông dân phù hợp.' : 'Chưa có nông dân nào. Bấm "Thêm nhanh" để thêm.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {results.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onPick(f)}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary-soft/50"
              >
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                  {f.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-ink">{f.name}</span>
                  <span className="text-stone-600">{f.phone}</span>
                </span>
                {chosenIds.includes(f.id) ? (
                  <Badge tone="green">Đã chọn</Badge>
                ) : (
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-stone-400" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
