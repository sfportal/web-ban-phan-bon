import { exportProducts } from '@/lib/admin/products-actions'

export async function GET() {
  const file = await exportProducts()
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="san-pham.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
