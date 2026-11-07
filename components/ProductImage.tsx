import { PackageArt } from './PackageArt'

// Ảnh sản phẩm; chưa có ảnh thì vẽ ảnh minh họa bao bì theo quy cách và nhóm.
export function ProductImage({
  url,
  name,
  className = '',
  unit,
  brand,
  categorySlug,
}: {
  url: string | null
  name: string
  className?: string
  unit?: string | null
  brand?: string | null
  categorySlug?: string | null
}) {
  if (!url) {
    return <PackageArt name={name} unit={unit} brand={brand} categorySlug={categorySlug} className={className} />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={name} loading="lazy" className={`object-cover ${className}`} />
}
