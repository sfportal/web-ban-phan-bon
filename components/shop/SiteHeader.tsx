'use client'

import { Search, ShoppingBag, Sprout, UserRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, useSyncExternalStore } from 'react'
import { replaceShopParams } from '@/components/Storefront'
import { useCart } from '@/lib/cart/use-cart'

const subscribeNoop = () => () => {}

const INPUT =
  'h-11 w-full rounded-xl border-0 bg-white pl-11 pr-3 text-base text-ink shadow-inner shadow-stone-900/5 placeholder:text-stone-500 focus-visible:outline-accent'

/** Đưa lưới sản phẩm vào khung nhìn nếu đang ở ngoài (đang xem hero mà gõ tìm). */
function revealGrid() {
  const grid = document.getElementById('san-pham')
  if (!grid) return
  const top = grid.getBoundingClientRect().top
  if (top > window.innerHeight * 0.6 || top < 0) grid.scrollIntoView({ block: 'start' })
}

function SearchField({ value, onChange }: { value: string; onChange?: (v: string) => void }) {
  return (
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-stone-500" />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={!onChange}
        placeholder="Tìm phân bón, thuốc, vật tư…"
        aria-label="Tìm trong cửa hàng"
        enterKeyHint="search"
        className={INPUT}
      />
    </div>
  )
}

/**
 * Ô tìm: ở trang chủ lọc lưới ngay khi gõ (ghi ?q= lên URL); trang khác bấm tìm thì
 * chuyển về trang chủ kèm từ khóa.
 */
function HeaderSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const urlQ = useSearchParams().get('q') ?? ''
  const [value, setValue] = useState(urlQ)
  const [seenQ, setSeenQ] = useState(urlQ)
  // URL đổi từ nơi khác (nút "Xem tất cả sản phẩm") → đồng bộ ô tìm.
  // Chỉ ghi đè khi URL thật sự khác chữ đang gõ: URL lưu bản đã trim, cập nhật trễ không được
  // xóa dấu cách cuối khi người dùng đang gõ dở ("phân " → "phân").
  if (urlQ !== seenQ) {
    setSeenQ(urlQ)
    if (urlQ !== value.trim()) setValue(urlQ)
  }
  const onHome = pathname === '/'

  return (
    <form
      role="search"
      className="min-w-0 flex-1"
      onSubmit={(e) => {
        e.preventDefault()
        const q = value.trim()
        if (onHome) revealGrid()
        else router.push(q ? `/?q=${encodeURIComponent(q)}#san-pham` : '/#san-pham')
      }}
    >
      <SearchField
        value={value}
        onChange={(v) => {
          setValue(v)
          if (onHome) {
            replaceShopParams({ q: v.trim() || null })
            revealGrid()
          }
        }}
      />
    </form>
  )
}

function CartLink() {
  const { items } = useCart()
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const count = hydrated ? items.reduce((n, i) => n + i.qty, 0) : 0
  return (
    <Link
      href="/gio-hang"
      aria-label={`Giỏ hàng (${count})`}
      className="relative flex h-11 shrink-0 items-center gap-2 rounded-xl bg-accent px-3 font-semibold text-ink transition-colors hover:bg-yellow-500"
    >
      <ShoppingBag aria-hidden className="size-5" />
      <span className="hidden md:inline">Giỏ hàng</span>
      <span aria-hidden className="flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-sm font-bold tabular-nums text-white">
        {count}
      </span>
    </Link>
  )
}

/** Header dính: tên cửa hàng, ô tìm, đăng nhập CTV, giỏ hàng kèm số lượng. */
export function SiteHeader({ storeName }: { storeName: string }) {
  return (
    <header className="sticky top-0 z-30 bg-primary text-white shadow-[0_1px_0_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:flex-nowrap md:gap-5 md:py-3">
        <Link href="/" className="flex h-11 min-w-0 flex-1 items-center gap-2.5 md:flex-none">
          <span aria-hidden className="hidden size-9 shrink-0 items-center sm:flex justify-center rounded-full bg-white/12 ring-1 ring-white/25">
            <Sprout className="size-5 text-accent-soft" />
          </span>
          <span className="line-clamp-2 text-lg font-bold leading-tight tracking-tight">{storeName}</span>
        </Link>
        <div className="order-last w-full md:order-none md:w-auto md:max-w-xl md:flex-1">
          <Suspense fallback={<SearchField value="" />}>
            <HeaderSearch />
          </Suspense>
        </div>
        <Link
          href="/dang-nhap"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 font-semibold text-white/95 hover:bg-white/10 md:ml-auto md:px-3"
        >
          <UserRound aria-hidden className="size-5" />
          <span>
            <span className="sr-only md:not-sr-only">Đăng nhập </span>CTV
          </span>
        </Link>
        <CartLink />
      </div>
    </header>
  )
}
