import { Suspense } from 'react'
import { FloatingActions } from '@/components/CartFab'
import { Storefront } from '@/components/Storefront'
import { getCatalog, getPublicSettings } from '@/lib/catalog/queries'
import { SITE_NAME } from '@/lib/site'
import { createServerClient } from '@/lib/supabase/server'

async function Shop() {
  const db = createServerClient()
  const [catalog, settings] = await Promise.all([getCatalog(db), getPublicSettings(db)])
  return (
    <>
      <h1 className="text-2xl font-bold">{settings.storeName ?? SITE_NAME}</h1>
      <Storefront products={catalog.products} categories={catalog.categories} promos={catalog.promos} />
      <FloatingActions zaloLink={settings.zaloLink} />
    </>
  )
}

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 pb-24 text-base">
      <Suspense fallback={<h1 className="text-2xl font-bold">{SITE_NAME}</h1>}>
        <Shop />
      </Suspense>
    </main>
  )
}
