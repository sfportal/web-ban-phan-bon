'use client'

import { ImageUp, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { ProductImage } from '@/components/ProductImage'
import { Badge, Button, Card, Field, Input, Select, Textarea } from '@/components/ui'
import { saveProduct } from '@/lib/admin/products-actions'
import { formatVnd } from '@/lib/format'

export type ProductFormValues = {
  id?: string
  sku: string
  name: string
  unit: string
  categoryId: string
  listPrice: number
  imageUrl: string | null
  inStock: boolean
  isActive: boolean
  description: string
  brand: string
  shortDesc: string
  composition: string
  benefits: string
  usage: string
  /** Cây trồng, phân cách bằng dấu phẩy. */
  crops: string
  isFeatured: boolean
}

type Category = { id: string; name: string; slug?: string | null }
/** Các ô ảnh hưởng tới phần xem trước; còn lại là ô không điều khiển (defaultValue). */
type Preview = Pick<ProductFormValues, 'name' | 'unit' | 'brand' | 'categoryId' | 'shortDesc'> & { price: string; imageUrl: string }

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card as="section" className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {hint && <p className="text-sm text-stone-600">{hint}</p>}
      </div>
      {children}
    </Card>
  )
}

function Check({ name, label, hint, defaultChecked }: { name: string; label: string; hint: string; defaultChecked: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-1 py-2 hover:bg-stone-50">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-5 shrink-0 accent-primary" />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-stone-600">{hint}</span>
      </span>
    </label>
  )
}

export function ProductForm({ initial, categories }: { initial: ProductFormValues; categories: Category[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<Preview>({
    name: initial.name, unit: initial.unit, brand: initial.brand, categoryId: initial.categoryId, shortDesc: initial.shortDesc,
    price: initial.listPrice ? String(initial.listPrice) : '', imageUrl: initial.imageUrl ?? '',
  })
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl) }, [fileUrl])

  const watch = (key: keyof Preview) => (e: { target: { value: string } }) => setPreview((p) => ({ ...p, [key]: e.target.value }))
  const category = categories.find((c) => c.id === preview.categoryId)
  const price = Number(preview.price.replace(/\D/g, ''))
  const imageUrl = fileUrl ?? (/^https?:\/\//.test(preview.imageUrl.trim()) ? preview.imageUrl.trim() : null)

  return (
    <form
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
      action={(form) =>
        start(async () => {
          setError(''); setNotice('')
          const res = await saveProduct(form)
          if (res.status === 'invalid') return setError(res.message)
          if (res.imageError) {
            setNotice(res.imageError)
            if (!initial.id) router.replace(`/admin/san-pham/${res.id}`)
            else router.refresh()
            return
          }
          router.push('/admin/san-pham')
        })
      }
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="flex min-w-0 flex-col gap-6">
        <Section title="Thông tin bán hàng">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên sản phẩm" className="sm:col-span-2">
              <Input name="name" required defaultValue={initial.name} onChange={watch('name')} />
            </Field>
            <Field label="SKU"><Input name="sku" required defaultValue={initial.sku} /></Field>
            <Field label="Nhóm">
              <Select name="categoryId" required defaultValue={initial.categoryId} onChange={watch('categoryId')}>
                <option value="" disabled>Chọn nhóm</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Thương hiệu">
              <Input name="brand" defaultValue={initial.brand} placeholder="Bình Điền (Đầu Trâu)" onChange={watch('brand')} />
            </Field>
            <Field label="Quy cách">
              <Input name="unit" defaultValue={initial.unit} placeholder="bao 50kg" onChange={watch('unit')} />
            </Field>
            <Field label="Giá niêm yết (đ)" hint="Giá tham khảo thị trường — sửa theo giá bán thực tế">
              <Input name="listPrice" required inputMode="numeric" defaultValue={initial.listPrice || ''} onChange={watch('price')} />
            </Field>
          </div>
        </Section>

        <Section title="Nội dung trang sản phẩm" hint="Hiện ở thẻ sản phẩm và các tab trên trang chi tiết. Ô trống thì tab tương ứng được ẩn.">
          <Field label="Mô tả ngắn">
            <Input name="shortDesc" defaultValue={initial.shortDesc} placeholder="Một câu giới thiệu hiện trên thẻ sản phẩm" onChange={watch('shortDesc')} />
          </Field>
          <Field label="Thành phần"><Textarea name="composition" rows={3} defaultValue={initial.composition} /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Công dụng"><Textarea name="benefits" rows={5} defaultValue={initial.benefits} placeholder="Mỗi ý một dòng" /></Field>
            <Field label="Cách dùng"><Textarea name="usage" rows={5} defaultValue={initial.usage} placeholder="Mỗi ý một dòng" /></Field>
          </div>
          <Field label="Cây trồng" hint="Phân cách bằng dấu phẩy">
            <Input name="crops" defaultValue={initial.crops} placeholder="Lúa, Cà phê, Sầu riêng" />
          </Field>
          <Field label="Mô tả thêm"><Textarea name="description" rows={4} defaultValue={initial.description} /></Field>
        </Section>

        <Section title="Ảnh" hint="Chưa có ảnh thì cửa hàng tự vẽ bao bì minh họa theo quy cách và nhóm.">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">Tải ảnh lên (JPG, PNG, WebP, tối đa 2MB)</span>
            <input
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0]
                setFileUrl(f ? URL.createObjectURL(f) : null)
              }}
              className="text-base file:mr-3 file:h-11 file:cursor-pointer file:rounded-xl file:border file:border-primary/25 file:bg-white file:px-4 file:font-semibold file:text-primary hover:file:bg-primary-soft"
            />
          </label>
          <Field label="Hoặc dán link ảnh (xóa trống để bỏ ảnh)">
            <Input name="imageUrl" type="url" defaultValue={initial.imageUrl ?? ''} placeholder="https://..." onChange={watch('imageUrl')} />
          </Field>
        </Section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
        <Card className="overflow-hidden">
          <p className="flex items-center gap-2 border-b border-stone-100 px-4 py-2.5 text-sm font-semibold text-stone-600">
            <ImageUp aria-hidden className="size-4" />Xem trước trên cửa hàng
          </p>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-4 p-4 lg:grid-cols-1 lg:gap-3">
            <ProductImage
              url={imageUrl}
              name={preview.name.trim() || 'Tên sản phẩm'}
              unit={preview.unit}
              brand={preview.brand}
              categorySlug={category?.slug}
              sizes="288px"
              className="aspect-[5/6] w-full rounded-xl"
            />
            <div className="flex min-w-0 flex-col gap-1">
              {preview.brand.trim() && <p className="text-sm font-semibold text-primary">{preview.brand}</p>}
              <p className="text-lg font-bold leading-snug text-ink">{preview.name.trim() || 'Tên sản phẩm'}</p>
              {preview.unit.trim() && <p className="text-stone-600">{preview.unit}</p>}
              {preview.shortDesc.trim() && <p className="text-sm text-stone-600">{preview.shortDesc}</p>}
              <p className="mt-1 text-xl font-bold tabular-nums text-ink">{price > 0 ? formatVnd(price) : 'Chưa có giá'}</p>
              {fileUrl && <Badge tone="blue" className="mt-1 self-start">Ảnh mới, chưa lưu</Badge>}
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-1 p-3">
          <Check name="inStock" label="Còn hàng" hint="Tắt khi hết hàng: khách không đặt được." defaultChecked={initial.inStock} />
          <Check name="isActive" label="Hiển thị" hint="Tắt để ẩn khỏi cửa hàng." defaultChecked={initial.isActive} />
          <Check name="isFeatured" label="Nổi bật" hint="Đưa lên mục nổi bật ở trang chủ." defaultChecked={initial.isFeatured} />
        </Card>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-accent-soft p-3 text-yellow-900">{notice}</p>}
        <div className="flex gap-3">
          <Button type="submit" size="lg" disabled={pending} className="flex-1">
            <Save aria-hidden className="size-5" />{pending ? 'Đang lưu...' : 'Lưu'}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => router.push('/admin/san-pham')}>Quay lại</Button>
        </div>
      </aside>
    </form>
  )
}
