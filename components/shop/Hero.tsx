import { ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { RemoteImage } from '@/components/ui'
import { IMAGES } from '@/lib/media/images'

const CTA = 'inline-flex h-[52px] items-center justify-center gap-2 rounded-xl px-6 text-lg font-semibold transition-colors'

/** Ảnh ruộng lúa tràn khung, khẩu hiệu lớn, hai nút: mua ngay (cuộn tới lưới) và đăng ký CTV. */
export function Hero() {
  return (
    <div className="mx-auto w-full max-w-6xl md:px-4 md:pt-4">
      <section className="relative isolate overflow-hidden bg-primary-hover text-white md:rounded-[28px]">
        <RemoteImage
          src={IMAGES.hero.url}
          alt={IMAGES.hero.alt}
          sizes="(min-width: 1152px) 1120px, 100vw"
          priority
          fallbackTone="bg-[radial-gradient(120%_90%_at_85%_10%,#ca8a04_0%,#166534_55%,#14532d_100%)]"
          className="!absolute inset-0 -z-10"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0f3d22]/95 via-[#0f3d22]/55 to-[#0f3d22]/10 md:bg-gradient-to-r md:from-[#0f3d22]/90 md:via-[#0f3d22]/50 md:to-transparent"
        />
        <div className="mx-auto flex min-h-[480px] max-w-6xl flex-col justify-end gap-5 px-4 pb-8 pt-28 md:min-h-[520px] md:justify-center md:px-12 md:py-16">
          <h1 className="max-w-[13ch] text-balance text-[2.6rem] font-bold leading-[1.04] tracking-[-0.02em] md:text-7xl md:leading-[1.02]">
            Vật tư nông nghiệp chính hãng — giao tận vườn
          </h1>
          <p className="max-w-[34ch] text-lg leading-relaxed text-white/90">
            Phân bón, thuốc BVTV và vật tư của các hãng quen thuộc. Giá niêm yết rõ ràng, đặt hàng vài phút, trả tiền khi nhận.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="#san-pham" className={`${CTA} bg-accent text-ink hover:bg-yellow-500`}>
              <ShoppingCart aria-hidden className="size-5" />
              Mua ngay
            </Link>
            <Link href="/dang-ky" className={`${CTA} border border-white/45 text-white hover:bg-white/10`}>
              Trở thành CTV
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
