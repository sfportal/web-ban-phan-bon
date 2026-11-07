import Link from 'next/link'
import { Suspense } from 'react'
import { ImportExcel } from '@/components/admin/ImportExcel'
import { ToggleButton } from '@/components/admin/ToggleButton'
import { Money } from '@/components/Money'
import { requireStaff } from '@/lib/auth/guards'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'

export const metadata = { title: `Sản phẩm — ${SITE_NAME}` }

const linkButton = 'flex h-11 items-center rounded-lg border border-green-700 px-4 font-semibold text-green-800'

async function Products({ searchParams }: Pick<PageProps<'/admin/san-pham'>, 'searchParams'>) {
  const { role } = await requireStaff() // nhân viên thường chỉ xem
  const canWrite = role === 'admin'
  const raw = (await searchParams).nhom
  const db = adminClient()
  const { data: categories } = await db.from('categories').select('id, name').order('sort_order').order('name').throwOnError()
  const nhom = typeof raw === 'string' && categories.some((c) => c.id === raw) ? raw : ''

  const products = await fetchAll((from, to) => {
    let q = db.from('products')
      .select('id, sku, name, unit, list_price, in_stock, is_active, categories(name)')
    if (nhom) q = q.eq('category_id', nhom)
    return q.order('sku').range(from, to).throwOnError()
  })

  return (
    <>
      <div className="flex flex-wrap items-start gap-2">
        <form action="/admin/san-pham" className="flex gap-2" role="search">
          <select name="nhom" defaultValue={nhom} aria-label="Lọc theo nhóm" className="h-11 rounded-lg border border-gray-300 px-3 text-base">
            <option value="">Tất cả nhóm</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="submit" className="h-11 rounded-lg bg-green-700 px-4 font-semibold text-white">Lọc</button>
        </form>
        {canWrite && (
          <>
            <Link href="/admin/san-pham/moi" className="flex h-11 items-center rounded-lg bg-green-700 px-4 font-semibold text-white">Thêm sản phẩm</Link>
            <ImportExcel />
            {/* Route handler tải file: dùng thẻ a để trình duyệt tải xuống, không điều hướng client. */}
            <a href="/admin/san-pham/xuat" download className={linkButton}>Xuất Excel</a>
            <a href="/admin/san-pham/mau" download className={linkButton}>Tải file mẫu</a>
          </>
        )}
      </div>
      <p className="text-sm text-gray-600">{products.length} sản phẩm</p>
      {products.length === 0 ? (
        <p className="py-8 text-center text-gray-600">Chưa có sản phẩm nào.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[40rem] text-left">
            <thead className="bg-gray-50 text-sm text-gray-600">
              <tr>
                <th className="p-3">SKU</th><th className="p-3">Tên</th><th className="p-3">Nhóm</th>
                <th className="p-3 text-right">Giá</th><th className="p-3">Còn hàng</th><th className="p-3">Hiển thị</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 whitespace-nowrap">{p.sku}</td>
                  <td className="p-3">
                    {canWrite
                      ? <Link href={`/admin/san-pham/${p.id}`} className="font-semibold text-green-800 underline">{p.name}</Link>
                      : <span className="font-semibold">{p.name}</span>}
                    {p.unit && <span className="block text-sm text-gray-600">{p.unit}</span>}
                  </td>
                  <td className="p-3">{p.categories?.name}</td>
                  <td className="p-3 text-right"><Money value={Number(p.list_price)} /></td>
                  <td className="p-3">
                    {canWrite ? <ToggleButton id={p.id} field="in_stock" on={p.in_stock} label={`Còn hàng: ${p.name}`} /> : p.in_stock ? 'Có' : 'Không'}
                  </td>
                  <td className="p-3">
                    {canWrite ? <ToggleButton id={p.id} field="is_active" on={p.is_active} label={`Hiển thị: ${p.name}`} /> : p.is_active ? 'Có' : 'Không'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default function ProductsPage({ searchParams }: PageProps<'/admin/san-pham'>) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Sản phẩm</h1>
      <Suspense fallback={<p className="py-8 text-center text-gray-600">Đang tải...</p>}>
        <Products searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
