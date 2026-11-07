import { HandCoins, Headset, ShieldCheck, Truck } from 'lucide-react'
import { RemoteImage } from '@/components/ui'
import { IMAGES } from '@/lib/media/images'

const ITEMS = [
  { icon: ShieldCheck, title: 'Hàng chính hãng', text: 'Đúng tem nhãn, rõ nguồn gốc từng lô hàng.' },
  { icon: Truck, title: 'Giao tận vườn', text: 'Giao tới nhà, kiểm hàng rồi mới trả tiền.' },
  { icon: Headset, title: 'Tư vấn kỹ thuật miễn phí', text: 'Hỏi cách bón, liều phun cho từng loại cây.' },
  { icon: HandCoins, title: 'Hoa hồng hấp dẫn cho CTV', text: 'Giới thiệu bà con mua hàng, nhận hoa hồng mỗi đơn.' },
] as const

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
        {ITEMS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4">
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-ink">
              <Icon className="size-6" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-lg font-bold leading-snug">{title}</span>
              <span className="text-white/85">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
