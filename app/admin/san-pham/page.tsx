import { Download, FileSpreadsheet, Package, Plus } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { ImportExcel } from '@/components/admin/ImportExcel'
import { TableCard, tbody, td, th, thead } from '@/components/admin/table'
import { ToggleButton } from '@/components/admin/ToggleButton'
import { Money } from '@/components/Money'
import { ProductImage } from '@/components/ProductImage'
import { Badge, Button, buttonClass, Card, EmptyState, Select } from '@/components/ui'
import { requireStaff } from '@/lib/auth/guards'
import { SITE_NAME } from '@/lib/site'
import { adminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'

export const metadata = { title: `Sản phẩm — ${SITE_NAME}` }

const TITLE = 'Sản phẩm'

async function Products({ searchParams }: Pick<PageProps<'/admin/san-pham'>, 'searchParams'>) {
  const { role } = await requireStaff() // nhân viên thường chỉ xem
  const canWrite = role === 'admin'
  const raw = (await searchParams).nhom
  const db = adminClient()
  const { data: categories } = await db.from('categories').select('id, name').order('sort_order').order('name').throwOnError()
  const nhom = typeof raw === 'string' && categories.some((c) => c.id === raw) ? raw : ''

  const products = await fetchAll((from, to) => {
    let q = db.from('products')
      .select('id, sku, name, unit, brand, image_url, list_price, in_stock, is_active, is_featured, categories(name, slug)')
    if (nhom) q = q.eq('category_id', nhom)
    return q.order('sku').range(from, to).throwOnError()
  })

  return (
    <>
      <PageHeader
        title={TITLE}
        subtitle={canWrite ? 'Bấm tên sản phẩm để sửa. Bật/tắt “Còn hàng”, “Hiển thị” ngay trên bảng.' : 'Danh sách sản phẩm (chỉ xem).'}
        actions={
          canWrite && (
            <>
              <Button href="/admin/san-pham/moi"><Plus aria-hidden className="size-5" />Thêm sản phẩm</Button>
              <ImportExcel />
              {/* Route handler tải file: dùng thẻ a để trình duyệt tải xuống, không điều hướng client. */}
              <a href="/admin/san-pham/xuat" download className={buttonClass({ variant: 'secondary' })}>
                <Download aria-hidden className="size-5" />Xuất Excel
              </a>
              <a href="/admin/san-pham/mau" download className={buttonClass({ variant: 'ghost' })}>
                <FileSpreadsheet aria-hidden className="size-5" />Tải file mẫu
              </a>
            </>
          )
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action="/admin/san-pham" className="flex gap-2" role="search">
          <Select name="nhom" defaultValue={nhom} aria-label="Lọc theo nhóm" className="w-auto max-w-[60vw]">
            <option value="">Tất cả nhóm</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Button type="submit" variant="secondary">Lọc</Button>
        </form>
        <p className="text-stone-600">{products.length} sản phẩm</p>
      </div>
      {products.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="size-7" />}
            title="Chưa có sản phẩm nào"
            description={canWrite ? 'Thêm từng sản phẩm hoặc nhập nhanh từ file Excel mẫu.' : undefined}
            action={canWrite && <Button href="/admin/san-pham/moi"><Plus aria-hidden className="size-5" />Thêm sản phẩm</Button>}
          />
        </Card>
      ) : (
        <TableCard>
          <table className="w-full min-w-[48rem] text-left">
            <thead className={thead}>
              <tr>
                <th className={th}>Sản phẩm</th><th className={th}>SKU</th><th className={th}>Nhóm</th>
                <th className={`${th} text-right`}>Giá</th><th className={th}>Còn hàng</th><th className={th}>Hiển thị</th>
              </tr>
            </thead>
            <tbody className={tbody}>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <ProductImage
                        url={p.image_url}
                        name={p.name}
                        unit={p.unit}
                        brand={p.brand}
                        categorySlug={p.categories?.slug}
                        sizes="48px"
                        className="size-12 shrink-0 rounded-lg"
                      />
                      <div className="min-w-0">
                        {canWrite
                          ? <Link href={`/admin/san-pham/${p.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">{p.name}</Link>
                          : <span className="font-semibold">{p.name}</span>}
                        <span className="flex flex-wrap items-center gap-x-2 text-sm text-stone-600">
                          {[p.brand, p.unit].filter(Boolean).join(' · ')}
                          {p.is_featured && <Badge tone="yellow">Nổi bật</Badge>}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className={`${td} whitespace-nowrap text-stone-700`}>{p.sku}</td>
                  <td className={`${td} text-stone-700`}>{p.categories?.name}</td>
                  <td className={`${td} text-right font-semibold tabular-nums whitespace-nowrap`}><Money value={Number(p.list_price)} /></td>
                  <td className={td}>
                    {canWrite ? <ToggleButton id={p.id} field="in_stock" on={p.in_stock} label={`Còn hàng: ${p.name}`} /> : p.in_stock ? 'Có' : 'Không'}
                  </td>
                  <td className={td}>
                    {canWrite ? <ToggleButton id={p.id} field="is_active" on={p.is_active} label={`Hiển thị: ${p.name}`} /> : p.is_active ? 'Có' : 'Không'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </>
  )
}

export default function ProductsPage({ searchParams }: PageProps<'/admin/san-pham'>) {
  return (
    <AdminMain>
      <Suspense fallback={<><PageHeader title={TITLE} /><Loading /></>}>
        <Products searchParams={searchParams} />
      </Suspense>
    </AdminMain>
  )
}
