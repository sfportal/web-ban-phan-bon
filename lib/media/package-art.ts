// Các hàm thuần cho ảnh minh họa bao bì (components/PackageArt.tsx): chọn hình theo quy cách,
// đọc tỉ lệ N-P-K trong tên, bảng màu theo nhóm và ngắt tên thành tối đa 2 dòng.

export type PackageShape = 'bag' | 'bottle' | 'pouch' | 'roll' | 'box'

/** Chữ thường, bỏ dấu tiếng Việt (kể cả đ → d) để so khớp quy cách. */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
}

// Xét theo thứ tự: "bao 20 lít" là bao, "thùng 12 chai" là chai.
const SHAPE_RULES: [PackageShape, RegExp][] = [
  ['bag', /\bbao\b/],
  ['bottle', /\b(chai|lo|can|ml|lit|l)\b|\d\s*(ml|l)\b/],
  ['pouch', /\b(goi|tui)\b/],
  ['roll', /\b(cuon|met|m)\b|\d\s*m\b/],
  ['box', /\b(cai|bo|chiec|thung)\b/],
]

export function packageShape(unit: string): PackageShape {
  const u = normalize(unit)
  return SHAPE_RULES.find(([, re]) => re.test(u))?.[0] ?? 'bag'
}

/** Tỉ lệ N-P-K đầu tiên trong tên ("NPK 16-16-8+TE" → "16-16-8"), không có thì null. */
export function npkRatio(name: string): string | null {
  return name.match(/(?<!\d)\d{1,2}-\d{1,2}-\d{1,2}(?!\d)/)?.[0] ?? null
}

export type ArtColors = { bg: string; fg: string; band: string }

// bg: nền khung ảnh; band: màu in chủ đạo của bao; fg: chữ/nét đậm cùng tông.
const COLORS: Record<string, ArtColors> = {
  npk: { bg: '#dcfce7', fg: '#14532d', band: '#166534' },
  'phan-don': { bg: '#e0f2fe', fg: '#0c4a6e', band: '#0369a1' },
  'huu-co': { bg: '#f5ead7', fg: '#422006', band: '#7c4a1e' },
  'phan-bon-la': { bg: '#ecfccb', fg: '#365314', band: '#4d7c0f' },
  'thuoc-bvtv': { bg: '#fee2e2', fg: '#7f1d1d', band: '#b91c1c' },
  'vat-tu': { bg: '#e7e5e4', fg: '#292524', band: '#57534e' },
}
const DEFAULT_COLORS: ArtColors = { bg: '#fef9c3', fg: '#713f12', band: '#a16207' }

export function categoryColors(slug: string | null): ArtColors {
  return (slug && COLORS[slug]) || DEFAULT_COLORS
}

/** Ngắt tên theo từ thành tối đa 2 dòng, mỗi dòng ≤ max ký tự; dòng 2 thừa thì cắt và thêm "…". */
export function shortLabel(name: string, max = 28): string[] {
  // Từ dài hơn một dòng thì chặt cứng thành nhiều mảnh.
  const words = name.trim().split(/\s+/).filter(Boolean).flatMap((w) => {
    const parts: string[] = []
    for (let i = 0; i < w.length; i += max) parts.push(w.slice(i, i + max))
    return parts
  })

  const take = (from: number, limit: number): [string, number] => {
    let line = ''
    let i = from
    while (i < words.length) {
      const next = line ? `${line} ${words[i]}` : words[i]
      if (next.length > limit) break
      line = next
      i++
    }
    return [line, i]
  }

  const [first, afterFirst] = take(0, max)
  if (afterFirst >= words.length) return first ? [first] : []
  const [second, afterSecond] = take(afterFirst, max)
  if (afterSecond >= words.length) return [first, second]

  const [cut] = take(afterFirst, max - 1)
  return [first, `${cut || words[afterFirst].slice(0, max - 1)}…`]
}

/** Một dòng ≤ max ký tự, ngắt theo từ, thừa thì thêm "…". */
export function oneLine(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : `${shortLabel(t, max - 1)[0]}…`
}

// Độ rộng ký tự (em) của Be Vietnam Pro đậm, làm tròn lên từ bảng hmtx của bản 700
// (W 1,057; M 0,89; m 0,896; w 0,88; chữ hoa ≤ 0,83; số ≤ 0,72; chữ thường trung bình 0,58).
const WIDE = new Set(['W'])
const EXTRA = new Set(['M', 'm', 'w', '@', '%', '#'])
const NARROW = new Set(['i', 'l', 'j', 'I', '.', ',', ':', ';', '!', "'", '|'])

/** Ước tính bề rộng chuỗi theo em, cố ý hơi dư để chữ gần giới hạn luôn được ép vừa. */
export function textWidthEm(text: string): number {
  let em = 0
  // Bỏ dấu thanh/dấu mũ (combining mark rộng 0), giữ chữ gốc.
  for (const ch of text.normalize('NFD').replace(/[̀-ͯ]/g, '')) {
    if (WIDE.has(ch)) em += 1.07
    else if (EXTRA.has(ch)) em += 0.9
    else if (NARROW.has(ch)) em += 0.32
    else if (ch === ' ') em += 0.25
    else if (/[A-ZĐ]/.test(ch)) em += 0.84
    else if (/[0-9]/.test(ch)) em += 0.72
    else if (/[-()/+]/.test(ch)) em += 0.5
    else em += 0.62
  }
  return em
}
