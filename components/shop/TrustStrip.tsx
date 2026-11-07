import { HandCoins, Headset, ShieldCheck, Truck } from 'lucide-react'
import { RemoteImage } from '@/components/ui'
import { IMAGES } from '@/lib/media/images'
import { TRUST_ITEMS } from '@/lib/site-copy'

const ICONS = { shield: ShieldCheck, truck: Truck, headset: Headset, coins: HandCoins } as const

/** Bốn cam kết của cửa hàng trên dải xanh, kèm ảnh cây con. */
export function TrustStrip() {
  return (
    <section aria-label="Cam kết của cửa hàng" className="overflow-hidden rounded-[28px] bg-primary text-white md:grid md:grid-cols-[2fr_3fr]">
      <RemoteImage
        src={IMAGES.trust.url}
        alt={IMAGES.trust.alt}
        sizes="(min-width: 768px) 40vw, 100vw"
        fallbackTone="bg-[radial-gradient(90%_120%_at_20%_100%,#ca8a04_0%,#166534_70%)]"
        className="aspect-[16/7] w-full md:aspect-auto md:h-full"
      />
      <ul className="grid grid-cols-1 gap-x-6 gap-y-5 p-6 sm:grid-cols-2 md:p-10">
        {TRUST_ITEMS.map(({ icon, title, text }) => {
          const Icon = ICONS[icon]
          return (
          <li key={title} className="flex gap-4">
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-ink">
              <Icon className="size-6" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-lg font-bold leading-snug">{title}</span>
              <span className="text-white/85">{text}</span>
            </span>
          </li>
          )
        })}
      </ul>
    </section>
  )
}
