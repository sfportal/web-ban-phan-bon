'use client'

import { Sprout } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'

/**
 * Ảnh ngoài (Unsplash/Pexels/Supabase Storage) qua next/image `fill`. Tải lỗi thì ẩn ảnh,
 * hiện nền chuyển màu. Tỷ lệ khung do `className` quyết định (vd. `aspect-video`).
 */
export function RemoteImage({ src, alt, fallbackTone, className = '', sizes, priority, unoptimized }: {
  src: string
  alt: string
  /** Lớp nền chuyển màu cho khung dự phòng, vd. `bg-gradient-to-br from-primary-soft to-accent-soft`. */
  fallbackTone?: string
  className?: string
  sizes: string
  priority?: boolean
  /** Tải thẳng ảnh gốc, không qua bộ tối ưu (host chưa khai báo trong images.remotePatterns). */
  unoptimized?: boolean
}) {
  // Ghi theo src để đổi ảnh khác thì thử tải lại.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = failedSrc === src

  return (
    <div className={`relative overflow-hidden ${className}`.trim()}>
      {failed ? (
        <div
          data-testid="image-fallback"
          role="img"
          aria-label={alt}
          className={`absolute inset-0 flex items-center justify-center ${fallbackTone ?? 'bg-gradient-to-br from-primary-soft to-accent-soft'}`}
        >
          <Sprout aria-hidden className="size-10 text-primary/30" />
        </div>
      ) : (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={unoptimized} className="object-cover" onError={() => setFailedSrc(src)} />
      )}
    </div>
  )
}
