'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toggleProduct } from '@/lib/admin/products-actions'

/** Công tắc bật/tắt nhanh ngay trên dòng sản phẩm. */
export function ToggleButton({
  id, field, on, label,
}: { id: string; field: 'in_stock' | 'is_active'; on: boolean; label: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [value, setValue] = useState(on)
  const [prev, setPrev] = useState(on)
  if (prev !== on) { setPrev(on); setValue(on) } // dữ liệu server mới thì đồng bộ lại
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await toggleProduct(id, field)
          if (res.status === 'ok') setValue(res.value)
          router.refresh()
        })
      }
      className={`flex h-11 min-w-16 items-center justify-center rounded-full px-3 text-sm font-semibold disabled:opacity-60 ${
        value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {value ? 'Có' : 'Không'}
    </button>
  )
}
