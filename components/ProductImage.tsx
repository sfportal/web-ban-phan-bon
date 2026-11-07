import { RemoteImage } from '@/components/ui'
import { allowsRemoteImage, imageRemotePatterns } from '@/lib/media/remote-patterns'
import { PackageArt } from './PackageArt'

const PATTERNS = imageRemotePatterns(process.env.NEXT_PUBLIC_SUPABASE_URL)

// Ảnh sản phẩm; chưa có ảnh thì vẽ ảnh minh họa bao bì theo quy cách và nhóm.
// Ảnh thật qua next/image; link host lạ (admin dán) tải thẳng, không qua bộ tối ưu.
export function ProductImage({
  url,
  name,
  className = '',
  unit,
  brand,
  categorySlug,
  sizes = '(min-width: 1024px) 25vw, 50vw',
  priority,
}: {
  url: string | null
  name: string
  className?: string
  unit?: string | null
  brand?: string | null
  categorySlug?: string | null
  sizes?: string
  priority?: boolean
}) {
  if (!url) {
    return <PackageArt name={name} unit={unit} brand={brand} categorySlug={categorySlug} className={className} />
  }
  return (
    <RemoteImage
      src={url}
      alt={name}
      sizes={sizes}
      priority={priority}
      unoptimized={!allowsRemoteImage(url, PATTERNS)}
      fallbackTone="bg-gradient-to-br from-stone-100 to-primary-soft"
      className={className}
    />
  )
}
