'use client'

import { useState } from 'react'

/**
 * "Chia sẻ bảng giá": dùng navigator.share nếu trình duyệt có; nếu không thì copy link
 * /bang-gia và tải ảnh /bang-gia/anh (cùng nhóm sản phẩm).
 */
export function SharePriceButton({ categoryId, className }: { categoryId?: string | null; className?: string }) {
  const [msg, setMsg] = useState<string | null>(null)
  const query = categoryId ? `?nhom=${encodeURIComponent(categoryId)}` : ''

  async function share() {
    const url = `${window.location.origin}/bang-gia${query}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Bảng giá', text: 'Bảng giá phân bón mới nhất', url })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return // người dùng đóng hộp chia sẻ
      }
    }
    let copied = false
    try {
      await navigator.clipboard.writeText(url)
      copied = true
    } catch {
      // Không có quyền clipboard: vẫn tải ảnh.
    }
    const a = document.createElement('a')
    a.href = `/bang-gia/anh${query}`
    a.download = 'bang-gia.png'
    document.body.append(a)
    a.click()
    a.remove()
    setMsg(copied ? 'Đã copy link và tải ảnh bảng giá.' : 'Đã tải ảnh bảng giá.')
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={share}
        className={
          className ??
          'flex h-11 items-center justify-center rounded-lg border border-green-700 px-4 font-semibold text-green-800'
        }
      >
        Chia sẻ bảng giá
      </button>
      {msg && <p role="status" className="text-sm text-gray-700">{msg}</p>}
    </div>
  )
}
