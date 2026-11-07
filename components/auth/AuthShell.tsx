import { BadgePercent, ListChecks, Smartphone, Sprout } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { RemoteImage } from '@/components/ui'
import { IMAGES } from '@/lib/media/images'
import { SITE_NAME } from '@/lib/site'

const BENEFITS = [
  { icon: BadgePercent, text: 'Hoa hồng theo từng đơn' },
  { icon: Smartphone, text: 'Lên đơn trên điện thoại trong 1 phút' },
  { icon: ListChecks, text: 'Theo dõi đơn và hoa hồng minh bạch' },
] as const

/**
 * Khung trang đăng nhập / đăng ký / chờ duyệt. Desktop chia đôi: trái ảnh ruộng lúa kèm 3 lợi
 * ích CTV, phải form. Điện thoại: dải ảnh 160px, form nổi lên trên, lợi ích ở cuối trang.
 * Lưới một bản DOM duy nhất: khối lợi ích đặt chồng lên ảnh ở desktop bằng vị trí ô lưới.
 */
export function AuthShell({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="grid min-h-dvh flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:grid-rows-[1fr_auto]">
      <div className="relative isolate h-40 overflow-hidden bg-primary-hover lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:h-auto">
        <RemoteImage
          src={IMAGES.auth.url}
          alt={IMAGES.auth.alt}
          sizes="(min-width: 1024px) 52vw, 100vw"
          priority
          fallbackTone="bg-[radial-gradient(120%_90%_at_80%_0%,#ca8a04_0%,#166534_55%,#14532d_100%)]"
          className="!absolute inset-0 -z-10"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0f3d22]/75 via-[#0f3d22]/25 to-[#0f3d22]/45 lg:bg-gradient-to-t lg:from-[#0f3d22]/95 lg:via-[#0f3d22]/35 lg:to-[#0f3d22]/55"
        />
        <Link href="/" className="m-3 inline-flex h-11 items-center gap-2.5 rounded-xl px-1 text-white lg:m-10">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
            <Sprout className="size-5 text-accent-soft" />
          </span>
          <span className="text-lg font-bold tracking-tight">{SITE_NAME}</span>
        </Link>
      </div>

      <main className="relative z-10 -mt-6 flex flex-col rounded-t-[28px] bg-cream px-4 pb-8 pt-7 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:items-center lg:justify-center lg:rounded-none lg:px-12 lg:py-16">
        <div className="flex w-full max-w-md flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-[1.9rem] font-bold leading-tight tracking-[-0.015em] text-ink lg:text-4xl">{title}</h1>
            {subtitle && <p className="text-base leading-relaxed text-stone-600">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>

      <aside
        aria-labelledby="auth-benefits"
        className="mx-4 mb-10 flex flex-col gap-4 border-t border-stone-200 pt-6 lg:z-10 lg:col-start-1 lg:row-start-2 lg:mx-10 lg:mb-12 lg:max-w-lg lg:border-0 lg:pt-0 lg:text-white"
      >
        <h2 id="auth-benefits" className="text-lg font-bold tracking-tight text-ink lg:text-[2.6rem] lg:leading-[1.08] lg:tracking-[-0.02em] lg:text-white">
          Làm cộng tác viên cùng cửa hàng
        </h2>
        <ul className="flex flex-col gap-3 lg:gap-4">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-stone-700 lg:text-lg lg:text-white/95">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary lg:bg-white/12 lg:text-accent-soft lg:ring-1 lg:ring-white/25">
                <Icon className="size-5" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
