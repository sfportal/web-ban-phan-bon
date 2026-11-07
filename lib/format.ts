export function formatVnd(n: number): string {
  const rounded = Math.round(n)
  const abs = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${rounded < 0 ? '-' : ''}${abs} đ`
}

// Ngày giờ: luôn hiển thị / tính theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè).
const TZ = 'Asia/Ho_Chi_Minh'
const VN_OFFSET_MS = 7 * 3600_000

function vnParts(d: Date | string): Record<'year' | 'month' | 'day' | 'hour' | 'minute', string> {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(d))
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') }
}

/** dd/MM/yyyy */
export function formatDate(d: Date | string): string {
  const p = vnParts(d)
  return `${p.day}/${p.month}/${p.year}`
}

/** HH:mm dd/MM/yyyy */
export function formatDateTime(d: Date | string): string {
  const p = vnParts(d)
  return `${p.hour}:${p.minute} ${p.day}/${p.month}/${p.year}`
}

/** Kỳ YYYY-MM (kỳ hoa hồng, nhóm theo tháng). */
export function vnPeriod(d: Date | string): string {
  const p = vnParts(d)
  return `${p.year}-${p.month}`
}

/** 0h giờ VN của ngày cách ngày hôm nay (giờ VN) `daysAgo` ngày. */
export function vnDayStart(daysAgo: number, now: Date = new Date()): Date {
  const p = vnParts(now)
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day - daysAgo) - VN_OFFSET_MS)
}

/** Ngày yyyy-mm-dd (giờ VN) → 0h giờ VN của ngày đó cộng `plusDays` ngày; null nếu không phải ngày hợp lệ. */
export function vnDateStart(ymd: string, plusDays = 0): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const utc = new Date(Date.UTC(y, mo - 1, d))
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d) return null
  return new Date(utc.getTime() + plusDays * 86400_000 - VN_OFFSET_MS)
}

/** yyyy-mm-dd (giờ VN) của một thời điểm, trừ `minusDays` ngày (để hiển thị ngày kết thúc inclusive). */
export function vnDateInput(d: Date | string, minusDays = 0): string {
  const p = vnParts(new Date(new Date(d).getTime() - minusDays * 86400_000))
  return `${p.year}-${p.month}-${p.day}`
}
