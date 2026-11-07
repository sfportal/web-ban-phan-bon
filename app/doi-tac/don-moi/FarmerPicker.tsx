'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { addFarmer, searchMyFarmers, type AddFarmerResult, type FarmerSummary } from '@/lib/farmers/actions'

const field = 'h-12 w-full rounded-lg border border-gray-300 px-3 text-base'
const labelCls = 'flex flex-col gap-1 font-semibold'
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
        <h1 id="farmer-step" className="text-2xl font-bold">Chọn nông dân</h1>
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-11 px-2 font-semibold text-green-700">
            Quay lại
          </button>
        )}
      </div>

      {adding ? (
        <form onSubmit={onAdd} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
          <h2 className="text-lg font-semibold">Thêm nhanh nông dân</h2>
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
            <p role="alert" className="font-semibold text-red-700">
              {addError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="h-12 flex-1 rounded-lg bg-green-700 font-semibold text-white disabled:opacity-50"
            >
              {pending ? 'Đang lưu...' : 'Lưu và chọn'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setAddError(null)
              }}
              className="h-12 rounded-lg border border-gray-300 px-4 font-semibold"
            >
              Hủy
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-12 rounded-lg border-2 border-dashed border-green-700 font-semibold text-green-700"
        >
          + Thêm nhanh nông dân
        </button>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm theo tên hoặc SĐT..."
        aria-label="Tìm nông dân"
        className="h-12 w-full rounded-lg border border-gray-300 px-3 text-base"
      />
      {searchError && (
        <p role="alert" className="font-semibold text-red-700">
          {searchError}
        </p>
      )}
      {results === null ? (
        !searchError && <p className="py-4 text-center text-gray-600">Đang tải...</p>
      ) : results.length === 0 ? (
        <p className="py-4 text-center text-gray-600">
          {query.trim() ? 'Không tìm thấy nông dân phù hợp.' : 'Chưa có nông dân nào. Bấm "Thêm nhanh" để thêm.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border border-gray-200">
          {results.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onPick(f)}
                className="flex min-h-14 w-full items-center justify-between gap-2 px-4 py-2 text-left"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{f.name}</span>
                  <span className="text-gray-600">{f.phone}</span>
                </span>
                {chosenIds.includes(f.id) && <span className="text-sm font-semibold text-green-700">Đã chọn</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
