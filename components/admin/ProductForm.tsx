'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ProductImage } from '@/components/ProductImage'
import { saveProduct } from '@/lib/admin/products-actions'

export type ProductFormValues = {
  id?: string
  sku: string
  name: string
  unit: string
  categoryId: string
  listPrice: number
  imageUrl: string | null
  inStock: boolean
  isActive: boolean
  description: string
}

const input = 'h-11 w-full rounded-lg border border-gray-300 px-3 text-base'

export function ProductForm({ initial, categories }: { initial: ProductFormValues; categories: { id: string; name: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  return (
    <form
      className="flex flex-col gap-4"
      action={(form) =>
        start(async () => {
          setError(''); setNotice('')
          const res = await saveProduct(form)
          if (res.status === 'invalid') return setError(res.message)
          if (res.imageError) {
            setNotice(res.imageError)
            if (!initial.id) router.replace(`/admin/san-pham/${res.id}`)
            else router.refresh()
            return
          }
          router.push('/admin/san-pham')
        })
      }
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1"><span className="font-semibold">SKU</span>
          <input name="sku" required defaultValue={initial.sku} className={input} /></label>
        <label className="flex flex-col gap-1"><span className="font-semibold">Tên sản phẩm</span>
          <input name="name" required defaultValue={initial.name} className={input} /></label>
        <label className="flex flex-col gap-1"><span className="font-semibold">Quy cách</span>
          <input name="unit" defaultValue={initial.unit} placeholder="bao 50kg" className={input} /></label>
        <label className="flex flex-col gap-1"><span className="font-semibold">Nhóm</span>
          <select name="categoryId" required defaultValue={initial.categoryId} className={input}>
            <option value="" disabled>Chọn nhóm</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="font-semibold">Giá niêm yết (đ)</span>
          <input name="listPrice" required inputMode="numeric" defaultValue={initial.listPrice || ''} className={input} /></label>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex h-11 items-center gap-2"><input type="checkbox" name="inStock" defaultChecked={initial.inStock} className="size-5" /> Còn hàng</label>
          <label className="flex h-11 items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={initial.isActive} className="size-5" /> Hiển thị</label>
        </div>
      </div>
      <label className="flex flex-col gap-1"><span className="font-semibold">Mô tả</span>
        <textarea name="description" rows={4} defaultValue={initial.description} className="rounded-lg border border-gray-300 p-3 text-base" /></label>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3">
        <legend className="px-1 font-semibold">Ảnh</legend>
        <ProductImage url={initial.imageUrl} name={initial.name || 'sản phẩm'} className="h-32 w-32 rounded-lg" />
        <label className="flex flex-col gap-1"><span>Tải ảnh lên (JPG, PNG, WebP, tối đa 2MB)</span>
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="text-base" /></label>
        <label className="flex flex-col gap-1"><span>Hoặc dán link ảnh (xóa trống để bỏ ảnh)</span>
          <input name="imageUrl" type="url" defaultValue={initial.imageUrl ?? ''} placeholder="https://..." className={input} /></label>
      </fieldset>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-800">{notice}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="h-12 rounded-lg bg-green-700 px-6 font-semibold text-white disabled:opacity-60">
          {pending ? 'Đang lưu...' : 'Lưu'}
        </button>
        <button type="button" onClick={() => router.push('/admin/san-pham')} className="h-12 rounded-lg border border-gray-300 px-6 font-semibold">Quay lại</button>
      </div>
    </form>
  )
}
