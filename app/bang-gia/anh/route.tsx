import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { getPriceList } from '@/lib/catalog/price-list'
import { formatDate, formatVnd } from '@/lib/format'

// Ảnh bảng giá 1080px rộng để gửi Zalo/Facebook. Satori không đọc .woff2 nên dùng các file
// .woff của @fontsource. Mỗi subset (latin, latin-ext, vietnamese) là một file; đặt tên họ
// font riêng cho từng subset và liệt kê cả ba trong fontFamily để satori lấy glyph theo thứ tự
// (cùng một tên thì satori chỉ dùng một file → mất chữ có dấu tiếng Việt).
const FONT_DIR = path.join(process.cwd(), 'node_modules/@fontsource/be-vietnam-pro/files')
const SUBSETS = ['latin', 'latin-ext', 'vietnamese'] as const
const FAMILY = SUBSETS.map((s) => `BVP ${s}`).join(', ')
const FONT_FILES = SUBSETS.flatMap((subset) =>
  ([400, 700] as const).map((weight) => ({ subset, weight })),
)

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[]> | null = null
function loadFonts() {
  fonts ??= Promise.all(
    FONT_FILES.map(async ({ subset, weight }) => ({
      name: `BVP ${subset}`,
      data: await readFile(path.join(FONT_DIR, `be-vietnam-pro-${subset}-${weight}-normal.woff`)),
      weight,
      style: 'normal' as const,
    })),
  ).catch((e) => {
    fonts = null
    throw e
  })
  return fonts
}

const WIDTH = 1080
const HEADER = 230
const GROUP_TITLE = 76
const ROW = 92
const FOOTER = 110

export async function GET(request: NextRequest) {
  const [list, fontData] = await Promise.all([getPriceList(request.nextUrl.searchParams.get('nhom')), loadFonts()])
  const rowCount = list.groups.reduce((n, g) => n + g.rows.length, 0)
  const height = HEADER + list.groups.length * GROUP_TITLE + Math.max(rowCount, 1) * ROW + FOOTER

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', fontFamily: FAMILY, color: '#111827' }}>
        <div style={{ height: HEADER, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px', backgroundColor: '#15803d', color: '#ffffff' }}>
          <div style={{ fontSize: 34, fontWeight: 400 }}>{list.storeName}</div>
          <div style={{ fontSize: 60, fontWeight: 700 }}>{`Bảng giá ${list.category?.name ?? 'sản phẩm'}`}</div>
          <div style={{ fontSize: 30, fontWeight: 400 }}>{`Ngày ${formatDate(list.now)} · giá bán lẻ`}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 56px', flexGrow: 1 }}>
          {rowCount === 0 && (
            <div style={{ height: ROW, display: 'flex', alignItems: 'center', fontSize: 32 }}>Chưa có sản phẩm.</div>
          )}
          {list.groups.map((g) => (
            <div key={g.categoryName} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: GROUP_TITLE, display: 'flex', alignItems: 'flex-end', paddingBottom: 10, fontSize: 36, fontWeight: 700, color: '#166534' }}>
                {g.categoryName}
              </div>
              {g.rows.map((r) => (
                <div key={r.id} style={{ height: ROW, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 680 }}>
                    <div style={{ fontSize: 32, fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 24, color: '#4b5563' }}>
                      {`${r.unit} · cập nhật ${formatDate(r.updatedPriceAt)}${r.inStock ? '' : ' · tạm hết hàng'}`}
                    </div>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 700 }}>{formatVnd(r.price)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ height: FOOTER, display: 'flex', alignItems: 'center', padding: '0 56px', fontSize: 24, color: '#4b5563' }}>
          Giá đã gồm khuyến mãi đang áp dụng, có thể thay đổi theo thời điểm.
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height,
      fonts: fontData,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
