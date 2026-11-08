import { Suspense } from 'react'
import { AdminMain, Loading, PageHeader } from '@/components/admin/AdminPage'
import { DemoDataPanel } from '@/components/admin/DemoDataPanel'
import { getDemoStatus } from '@/lib/admin/demo-data'
import { requireStaff } from '@/lib/auth/guards'
import { SITE_NAME } from '@/lib/site'

export const metadata = { title: `Dữ liệu thử — ${SITE_NAME}` }

async function Demo() {
  await requireStaff('admin')
  const { exists } = await getDemoStatus()
  return <DemoDataPanel exists={exists} />
}

export default function DemoDataPage() {
  return (
    <AdminMain width="narrow">
      <PageHeader title="Dữ liệu thử" subtitle="Tạo đối tác, đơn và khoản chi giả để tập xử lý; các mục thử có nhãn “Thử” trong danh sách." />
      <Suspense fallback={<Loading />}>
        <Demo />
      </Suspense>
    </AdminMain>
  )
}
