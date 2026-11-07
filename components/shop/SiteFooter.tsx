import { MessageCircle, Sprout } from 'lucide-react'
import Link from 'next/link'
import { safeHttpUrl } from '@/lib/site'
import { FOOTER } from '@/lib/site-copy'

const LINK = 'flex min-h-11 items-center font-semibold text-white/90 hover:text-white'

/** Chân trang: tên cửa hàng, Zalo (nếu có), bảng giá, khu CTV. */
export function SiteFooter({ storeName, zaloLink }: { storeName: string; zaloLink: string | null }) {
  const zalo = safeHttpUrl(zaloLink)
  return (
    <footer className="mt-auto bg-primary-hover text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[3fr_2fr_2fr]">
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
            <Sprout aria-hidden className="size-6 text-accent" />
            {storeName}
          </p>
          <p className="max-w-sm text-white/80">{FOOTER.about}</p>
          {zalo && (
            <a href={zalo} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-white/10 px-4 font-semibold ring-1 ring-white/20 hover:bg-white/15">
              <MessageCircle aria-hidden className="size-5" />
              Nhắn Zalo cho cửa hàng
            </a>
          )}
        </div>
        <nav aria-label="Mua hàng" className="flex flex-col">
          <p className="mb-1 text-sm text-white/60">Mua hàng</p>
          <Link href="/" className={LINK}>Tất cả sản phẩm</Link>
          <Link href="/bang-gia" className={LINK}>Bảng giá hôm nay</Link>
        </nav>
        <nav aria-label="Cộng tác viên" className="flex flex-col">
          <p className="mb-1 text-sm text-white/60">Cộng tác viên</p>
          <Link href="/dang-ky" className={LINK}>Đăng ký làm CTV</Link>
          <Link href="/dang-nhap" className={LINK}>Khu CTV, đại lý</Link>
        </nav>
      </div>
      <p className="border-t border-white/10 px-4 py-4 text-center text-sm text-white/60">
        {FOOTER.note} {FOOTER.credit}
      </p>
    </footer>
  )
}
