import { downloadProductTemplate } from '@/lib/admin/products-actions'

export async function GET() {
  const file = await downloadProductTemplate()
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="mau-san-pham.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
