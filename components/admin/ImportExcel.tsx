'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { importProducts, type ImportResult } from '@/lib/admin/products-actions'

/** Nhập Excel: có lỗi thì hiện danh sách theo dòng và không ghi gì. */
export function ImportExcel() {
  const router = useRouter()
  const ref = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()
  const [result, setResult] = useState<ImportResult | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={ref}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const form = new FormData()
          form.set('file', file)
          start(async () => {
            setResult(await importProducts(form))
            if (ref.current) ref.current.value = ''
            router.refresh()
          })
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => ref.current?.click()}
        className="h-11 rounded-lg border border-green-700 px-4 font-semibold text-green-800 disabled:opacity-60"
      >
        {pending ? 'Đang nhập...' : 'Nhập Excel'}
      </button>
      {result && 'errors' in result && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          <p className="font-semibold">Không nhập được, chưa có dòng nào được ghi ({result.errors.length} lỗi):</p>
          <ul className="mt-1 max-h-64 list-disc overflow-y-auto pl-5">
            {result.errors.slice(0, 200).map((er, i) => (
              <li key={i}>{er.row > 0 ? `Dòng ${er.row}: ` : ''}{er.message}</li>
            ))}
          </ul>
          {result.errors.length > 200 && <p>... và {result.errors.length - 200} lỗi khác.</p>}
        </div>
      )}
      {result && 'created' in result && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">
          Đã nhập xong: thêm mới {result.created}, cập nhật {result.updated} sản phẩm.
        </p>
      )}
    </div>
  )
}
