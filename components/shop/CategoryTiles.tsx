import Link from 'next/link'
import { RemoteImage, SectionHeader } from '@/components/ui'
import { categoryKey } from '@/lib/catalog/category-key'
import type { CatalogCategory } from '@/lib/catalog/queries'
import { IMAGES, type ImageKey } from '@/lib/media/images'
import { allowsRemoteImage, imageRemotePatterns } from '@/lib/media/remote-patterns'

const PATTERNS = imageRemotePatterns(process.env.NEXT_PUBLIC_SUPABASE_URL)

/** Ảnh nhóm: ảnh admin đặt, không có thì ảnh minh họa theo slug (cat-<slug>). */
function tileImage(c: CatalogCategory): { url: string; alt: string } | null {
  if (c.imageUrl) return { url: c.imageUrl, alt: c.name }
  const meta = c.slug ? IMAGES[`cat-${c.slug}` as ImageKey] : undefined
  return meta ? { url: meta.url, alt: meta.alt } : null
}

const FALLBACK = 'bg-gradient-to-br from-primary-soft via-[#eef7e6] to-accent-soft'

/** Ô nhóm hàng có ảnh; bấm để lọc lưới sản phẩm (?nhom=<slug>). */
export function CategoryTiles({ categories, counts }: { categories: CatalogCategory[]; counts: Record<string, number> }) {
  if (categories.length === 0) return null
  return (
    <section aria-labelledby="nhom-hang" className="flex flex-col gap-4">
      <SectionHeader title={<span id="nhom-hang">Nhóm hàng</span>} />
      <ul className="-mx-4 flex snap-x scroll-px-4 md:scroll-px-0 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0">
        {categories.map((c) => {
          const img = tileImage(c)
          const n = counts[c.id] ?? 0
          return (
            <li key={c.id} className="w-[38vw] max-w-44 shrink-0 snap-start md:w-auto md:max-w-none">
              <Link href={`/?nhom=${encodeURIComponent(categoryKey(c))}#san-pham`} className="group flex flex-col gap-2">
                {img ? (
                  <RemoteImage
                    src={img.url}
                    alt={img.alt}
                    sizes="(min-width: 768px) 16vw, 40vw"
                    unoptimized={!allowsRemoteImage(img.url, PATTERNS)}
                    fallbackTone={FALLBACK}
                    className="aspect-square w-full rounded-2xl ring-1 ring-stone-900/5 transition-transform group-hover:-translate-y-0.5"
                  />
                ) : (
                  <div aria-hidden className={`aspect-square w-full rounded-2xl ${FALLBACK}`} />
                )}
                <span className="line-clamp-2 font-semibold leading-snug text-ink group-hover:text-primary">{c.name}</span>
                <span className="-mt-1.5 text-sm text-stone-500">{n} sản phẩm</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
