import Link from 'next/link'
import { Suspense } from 'react'
import { Money } from '@/components/Money'
import { SharePriceButton } from '@/components/SharePriceButton'
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
        active ? 'border-green-700 bg-green-700 text-white' : 'border-gray-300 text-gray-700'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Bảng giá {list.category ? list.category.name : ''}</h1>
        <p className="text-gray-700">{list.storeName} · Ngày {formatDate(list.now)}</p>
      </header>
      <nav aria-label="Nhóm sản phẩm" className="-mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-2">
          {chip('/bang-gia', 'Tất cả', list.category === null)}
          {list.categories.map((c) => chip(`/bang-gia?nhom=${c.id}`, c.name, list.category?.id === c.id))}
        </div>
      </nav>
      <SharePriceButton categoryId={list.category?.id} />
      {list.groups.length === 0 && <p className="py-8 text-center text-gray-600">Chưa có sản phẩm.</p>}
      {list.groups.map((g) => (
        <section key={g.categoryName} className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">{g.categoryName}</h2>
          <ul className="flex flex-col divide-y rounded-xl border border-gray-200">
            {g.rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{r.name}</span>
                  <span className="text-sm text-gray-600">
                    {r.unit} · cập nhật {formatDate(r.updatedPriceAt)}{!r.inStock && ' · tạm hết hàng'}
                  </span>
                </span>
                <Money value={r.price} className="shrink-0 font-bold" />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-sm text-gray-600">Giá bán lẻ đã gồm khuyến mãi đang áp dụng, có thể thay đổi theo thời điểm.</p>
    </>
  )
}

export default function PriceListPage({ searchParams }: PageProps<'/bang-gia'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 text-base">
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải bảng giá...</p>}>
        <PriceTable searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
