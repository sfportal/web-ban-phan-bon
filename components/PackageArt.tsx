import { categoryColors, npkRatio, oneLine, packageShape, shortLabel, textWidthEm, type PackageShape } from '@/lib/media/package-art'

// Ảnh minh họa bao bì tự vẽ cho sản phẩm chưa có ảnh: hình theo quy cách (bao, chai, gói, cuộn, hộp),
// màu theo nhóm, nhãn trắng ghi thương hiệu bằng chữ (không dùng logo hãng), tên, N-P-K và quy cách.

type Box = { x: number; y: number; w: number; h: number }
type Geometry = { label: Box; unitY: number; maxChars: number }

const INK = '#1c1917'
const PAPER = '#ffffff'

// maxChars ≈ (bề rộng nhãn − lề) / 5,6 — độ rộng trung bình một ký tự đậm cỡ 9,5.
export const PACKAGE_GEOMETRY: Record<PackageShape, Geometry> = {
  bag: { label: { x: 50, y: 58, w: 100, h: 118 }, unitY: 201, maxChars: 16 },
  bottle: { label: { x: 56, y: 86, w: 88, h: 100 }, unitY: 206, maxChars: 13 },
  pouch: { label: { x: 58, y: 64, w: 84, h: 108 }, unitY: 195, maxChars: 13 },
  roll: { label: { x: 60, y: 66, w: 80, h: 104 }, unitY: 194, maxChars: 12 },
  box: { label: { x: 50, y: 86, w: 90, h: 98 }, unitY: 204, maxChars: 14 },
}

// Lưới an toàn: chữ ước tính (theo độ rộng từng ký tự, hơi dư) rộng hơn nhãn thì ép vừa bề rộng.
function fit(text: string, fontSize: number, maxWidth: number) {
  return textWidthEm(text) * fontSize > maxWidth
    ? { textLength: maxWidth, lengthAdjust: 'spacingAndGlyphs' as const }
    : {}
}

function Body({ shape, band, fg }: { shape: PackageShape; band: string; fg: string }) {
  switch (shape) {
    case 'bag':
      // Bao dệt PP: thân hơi phình, mép trên may gấp (đường chỉ zigzag), mép dưới may thẳng.
      return (
        <g>
          <path d="M40 34 Q34 125 42 212 Q100 220 158 212 Q166 125 160 34 Z" fill={band} />
          <path d="M44 60 Q41 125 46 206 M156 60 Q159 125 154 206" stroke={PAPER} strokeOpacity="0.12" strokeWidth="6" fill="none" />
          <rect x="36" y="20" width="128" height="18" rx="3" fill={fg} />
          <path d="M42 29 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4"
            stroke={PAPER} strokeOpacity="0.7" strokeWidth="1.2" fill="none" />
          <path d="M46 209 Q100 216 154 209" stroke={fg} strokeWidth="2" strokeDasharray="3 2" fill="none" />
        </g>
      )
    case 'bottle':
      // Chai/can nhựa: nắp, cổ, vai có quai cầm.
      return (
        <g>
          <rect x="82" y="16" width="36" height="20" rx="4" fill={fg} />
          <path d="M86 22 h28 M86 28 h28" stroke={PAPER} strokeOpacity="0.25" strokeWidth="1.5" />
          <rect x="88" y="34" width="24" height="14" fill={band} />
          <path d="M88 46 Q50 52 46 80 L46 204 Q46 220 62 220 L138 220 Q154 220 154 204 L154 80 Q150 52 112 46 Z" fill={band} />
          <path d="M118 52 Q150 54 150 80" stroke={fg} strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M54 92 L54 196" stroke={PAPER} strokeOpacity="0.18" strokeWidth="5" strokeLinecap="round" />
        </g>
      )
    case 'pouch':
      // Gói đứng: mép hàn trên có rãnh xé, đường khóa kéo, đáy xòe.
      return (
        <g>
          <path d="M54 26 L146 26 L154 206 Q100 218 46 206 Z" fill={band} />
          <path d="M54 26 L146 26 L147 42 L53 42 Z" fill={fg} />
          <path d="M53 30 l5 4 l-5 4 Z" fill={PAPER} />
          <path d="M57 50 L143 50" stroke={PAPER} strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="4 3" />
          <path d="M52 200 Q100 210 148 200" stroke={fg} strokeOpacity="0.5" strokeWidth="1.5" fill="none" />
        </g>
      )
    case 'roll':
      // Cuộn (màng phủ, ống tưới): trụ đứng, mặt trên lộ lõi, mép cuộn ở cạnh phải.
      return (
        <g>
          <path d="M54 38 L54 204 A46 12 0 0 0 146 204 L146 38 Z" fill={band} />
          <ellipse cx="100" cy="38" rx="46" ry="12" fill={fg} />
          <ellipse cx="100" cy="38" rx="34" ry="8.5" fill="none" stroke={PAPER} strokeOpacity="0.25" />
          <ellipse cx="100" cy="38" rx="13" ry="4" fill={INK} fillOpacity="0.7" />
          <path d="M146 46 L146 196 L152 192 L152 50 Z" fill={fg} fillOpacity="0.6" />
        </g>
      )
    case 'box':
      // Hộp giấy: mặt trước, nắp và cạnh bên tạo khối.
      return (
        <g>
          <path d="M40 72 L60 52 L168 52 L148 72 Z" fill={fg} fillOpacity="0.55" />
          <path d="M148 72 L168 52 L168 196 L148 216 Z" fill={fg} />
          <rect x="40" y="72" width="108" height="144" fill={band} />
          <path d="M80 52 L60 72 M128 52 L108 72" stroke={PAPER} strokeOpacity="0.35" strokeWidth="1.5" />
        </g>
      )
  }
}

/** Mầm lá, dùng khi tên không có tỉ lệ N-P-K. */
function Sprout({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <path d="M0 12 L0 -2" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M0 -1 C-2 -10 -12 -12 -16 -8 C-12 -2 -4 -1 0 -1 Z" fill={color} />
      <path d="M0 2 C2 -9 12 -12 17 -9 C13 -2 5 1 0 2 Z" fill={color} fillOpacity="0.75" />
    </g>
  )
}

export function PackageArt({
  name,
  brand,
  unit,
  categorySlug,
  className = '',
}: {
  name: string
  brand?: string | null
  unit?: string | null
  categorySlug?: string | null
  className?: string
}) {
  const shape = packageShape(unit ?? '')
  const colors = categoryColors(categorySlug ?? null)
  const { label, unitY, maxChars } = PACKAGE_GEOMETRY[shape]
  const lines = shortLabel(name, maxChars)
  const brandLine = brand ? oneLine(brand, maxChars + 3) : null
  const npk = npkRatio(name)
  const cx = label.x + label.w / 2
  const textWidth = label.w - 8
  const npkSize = npk ? Math.min(22, (label.w - 12) / textWidthEm(npk)) : 0
  const unitText = unit ? oneLine(unit, maxChars + 2) : null

  return (
    <svg
      viewBox="0 0 200 240"
      role="img"
      aria-label={unit ? `${name} — ${unit}` : name}
      data-shape={shape}
      className={`block ${className}`}
      style={{ backgroundColor: colors.bg, fontFamily: 'inherit' }}
    >
      <ellipse cx="100" cy="224" rx="70" ry="7" fill={INK} fillOpacity="0.12" />
      <Body shape={shape} band={colors.band} fg={colors.fg} />

      <rect x={label.x} y={label.y} width={label.w} height={label.h} rx="6" fill={PAPER} />
      {brandLine && (
        <text x={cx} y={label.y + 15} textAnchor="middle" fontSize="8" fontWeight="600" fill={colors.band} {...fit(brandLine, 8, textWidth)}>
          {brandLine}
        </text>
      )}
      <path d={`M${label.x + 10} ${label.y + 22} H${label.x + label.w - 10}`} stroke={colors.band} strokeOpacity="0.35" />
      {lines.map((line, i) => (
        <text key={i} x={cx} y={label.y + 38 + i * 13} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={INK} {...fit(line, 9.5, textWidth)}>
          {line}
        </text>
      ))}
      {npk ? (
        <text x={cx} y={label.y + label.h - 14} textAnchor="middle" fontSize={npkSize.toFixed(1)} fontWeight="700" fill={colors.band}>
          {npk}
        </text>
      ) : (
        <Sprout cx={cx} cy={label.y + label.h - 24} color={colors.band} />
      )}

      {unitText && (
        <text x={cx} y={unitY} textAnchor="middle" fontSize="10" fontWeight="700" fill={PAPER} {...fit(unitText, 10, textWidth)}>
          {unitText}
        </text>
      )}
    </svg>
  )
}
