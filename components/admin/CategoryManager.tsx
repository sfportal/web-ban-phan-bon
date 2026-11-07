'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { deleteCategory, saveCategory } from '@/lib/admin/products-actions'

type Cat = { id: string; name: string; sortOrder: number; imageUrl: string | null; productCount: number }
const input = 'h-11 rounded-lg border border-gray-300 px-3 text-base'

function Row({ cat, readOnly }: { cat: Cat; readOnly: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')
  if (readOnly) {
    return (
      <li className="flex items-center justify-between gap-3 p-3">
        <span>{cat.name}</span>
        <span className="text-gray-600">{cat.productCount} sản phẩm</span>
      </li>
    )
  }
  return (
    <li className="flex flex-col gap-2 p-3">
      <form
        className="flex flex-wrap items-center gap-2"
        action={(form) =>
          start(async () => {
            const res = await saveCategory(form)
            setMsg(res.status === 'ok' ? 'Đã lưu' : res.message)
            router.refresh()
          })
        }
      >
        <input type="hidden" name="id" value={cat.id} />
        <input name="name" defaultValue={cat.name} required aria-label="Tên nhóm" className={`${input} min-w-0 flex-1`} />
        <input name="sortOrder" defaultValue={cat.sortOrder} inputMode="numeric" aria-label="Thứ tự" className={`${input} w-20`} />
        <input name="imageUrl" type="url" defaultValue={cat.imageUrl ?? ''} placeholder="https://..." aria-label="Link ảnh nhóm" className={`${input} min-w-0 basis-full sm:basis-auto sm:flex-1`} />
        <button type="submit" disabled={pending} className="h-11 rounded-lg bg-green-700 px-4 font-semibold text-white disabled:opacity-60">Lưu</button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Xóa nhóm “${cat.name}”?`)) return
            start(async () => {
              const res = await deleteCategory(cat.id)
              setMsg(res.status === 'category_in_use' ? `Không xóa được: nhóm còn ${cat.productCount || ''} sản phẩm` : res.status === 'not_found' ? 'Nhóm không còn tồn tại' : '')
              router.refresh()
            })
          }}
          className="h-11 rounded-lg border border-red-300 px-4 font-semibold text-red-700 disabled:opacity-60"
        >
          Xóa
        </button>
      </form>
      <span className="text-sm text-gray-600">{cat.productCount} sản phẩm{msg && ` · ${msg}`}</span>
    </li>
  )
}

export function CategoryManager({ categories, readOnly }: { categories: Cat[]; readOnly: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  return (
    <div className="flex flex-col gap-4">
      {categories.length === 0
        ? <p className="py-6 text-center text-gray-600">Chưa có nhóm nào.</p>
        : <ul className="divide-y rounded-xl border border-gray-200">{categories.map((c) => <Row key={c.id} cat={c} readOnly={readOnly} />)}</ul>}
      {!readOnly && (
        <form
          className="flex flex-wrap items-center gap-2"
          action={(form) =>
            start(async () => {
              const res = await saveCategory(form)
              setError(res.status === 'invalid' ? res.message : '')
              if (res.status === 'ok') router.refresh()
            })
          }
        >
          <input name="name" required placeholder="Tên nhóm mới" aria-label="Tên nhóm mới" className={`${input} min-w-0 flex-1`} />
          <input name="sortOrder" defaultValue={0} inputMode="numeric" aria-label="Thứ tự" className={`${input} w-20`} />
          <input name="imageUrl" type="url" placeholder="Link ảnh nhóm (https://...)" aria-label="Link ảnh nhóm" className={`${input} min-w-0 basis-full sm:basis-auto sm:flex-1`} />
          <button type="submit" disabled={pending} className="h-11 rounded-lg bg-green-700 px-4 font-semibold text-white disabled:opacity-60">Thêm nhóm</button>
          {error && <p role="alert" className="w-full text-red-700">{error}</p>}
        </form>
      )}
    </div>
  )
}
