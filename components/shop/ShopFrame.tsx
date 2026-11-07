import { connection } from 'next/server'
import { cache, Suspense, type ReactNode } from 'react'
import { FloatingActions } from '@/components/CartFab'
import { getPublicSettings } from '@/lib/catalog/queries'
import { SITE_NAME } from '@/lib/site'
import { createServerClient } from '@/lib/supabase/server'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

// Header và footer cùng đọc cài đặt công khai: một truy vấn mỗi yêu cầu. Chờ request thật trước
// (như guard): người đã đăng nhập có cookie phiên, supabase-js đọc Date.now() khi kiểm hạn phiên —
// lúc Next tải trước trang ở pha prerender sẽ báo lỗi blocking-prerender-current-time.
const loadSettings = cache(async () => {
  await connection()
  return getPublicSettings(createServerClient())
})

async function Header() {
  const { storeName } = await loadSettings()
  return <SiteHeader storeName={storeName ?? SITE_NAME} />
}

async function Footer() {
  const { storeName, zaloLink } = await loadSettings()
  return (
    <>
      <SiteFooter storeName={storeName ?? SITE_NAME} zaloLink={zaloLink} />
      <FloatingActions zaloLink={zaloLink} />
    </>
  )
}

/** Khung trang cửa hàng công khai: header dính, nội dung, footer và nút Zalo nổi. */
export function ShopFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<SiteHeader storeName={SITE_NAME} />}>
        <Header />
      </Suspense>
      {children}
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  )
}
