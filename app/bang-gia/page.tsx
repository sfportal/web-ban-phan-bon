import Link from 'next/link'
import { Suspense } from 'react'
import { Money } from '@/components/Money'
import { SharePriceButton } from '@/components/SharePriceButton'
import { ShopFrame } from '@/components/shop/ShopFrame'
import { EmptyState } from '@/components/ui'
import { getPriceList } from '@/lib/catalog/price-list'
import { formatDate } from '@/lib/format'
import { SITE_NAME } from '@/lib/site'

export const metadata = { title: `Bảng giá — ${SITE_NAME}` }

async function PriceTable({ searchParams }: Pick<PageProps<'/bang-gia'>, 'searchParams'>) {
  const list = await getPriceList((await searchParams).nhom)
  const chip = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex h-11 shrink-0 items-center rounded-full border px-4 font-semibold ${
        active ? 'border-primary bg-primary text-white' : 'border-stone-300 bg-white text-stone-700'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Bảng giá {list.category ? list.category.name : ''}</h1>
          <p className="text-stone-600">{list.storeName} · Ngày {formatDate(list.now)}</p>
        </div>
        <SharePriceButton
          categoryId={list.category?.id}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-white px-4 font-semibold text-primary hover:bg-primary-soft"
        />
      </header>
      <nav aria-label="Nhóm sản phẩm" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex min-w-max gap-2">
          {chip('/bang-gia', 'Tất cả', list.category === null)}
          {list.categories.map((c) => chip(`/bang-gia?nhom=${c.id}`, c.name, list.category?.id === c.id))}
        </div>
      </nav>
      {list.groups.length === 0 && <EmptyState title="Chưa có sản phẩm" description="Nhóm này chưa có mặt hàng đang bán." />}
      {list.groups.map((g) => (
        <section key={g.categoryName} className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-ink">{g.categoryName}</h2>
          <ul className="flex flex-col divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {g.rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 p-3 sm:px-4">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{r.name}</span>
                  <span className="text-sm text-stone-600">
                    {r.unit} · cập nhật {formatDate(r.updatedPriceAt)}
                    {!r.inStock && <span className="font-semibold text-red-700"> · tạm hết hàng</span>}
                  </span>
                </span>
                <Money value={r.price} className="shrink-0 text-lg font-bold tabular-nums text-primary" />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-sm text-stone-600">Giá bán lẻ đã gồm khuyến mãi đang áp dụng, có thể thay đổi theo thời điểm.</p>
    </>
  )
}

export default function PriceListPage({ searchParams }: PageProps<'/bang-gia'>) {
  return (
    <ShopFrame>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-16 pt-6 text-base">
        <Suspense fallback={<p className="py-8 text-center text-stone-600">Đang tải bảng giá...</p>}>
          <PriceTable searchParams={searchParams} />
        </Suspense>
      </main>
    </ShopFrame>
  )
}
