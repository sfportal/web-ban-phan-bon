import { describe, expect, test } from 'vitest'
import { formatDate, formatDateTime, vnDayStart, vnPeriod } from '@/lib/format'

// 2026-10-31T18:30:00Z = 01:30 ngày 01/11/2026 giờ Việt Nam (UTC+7).
const lateUtc = new Date('2026-10-31T18:30:00Z')

describe('ngày giờ theo Asia/Ho_Chi_Minh', () => {
  test('formatDate / formatDateTime', () => {
    expect(formatDate(lateUtc)).toBe('01/11/2026')
    expect(formatDateTime(lateUtc)).toBe('01:30 01/11/2026')
    expect(formatDate('2026-03-05T00:00:00+07:00')).toBe('05/03/2026')
  })

  test('vnPeriod: kỳ YYYY-MM theo giờ VN', () => {
    expect(vnPeriod(lateUtc)).toBe('2026-11')
    expect(vnPeriod(new Date('2026-10-31T16:59:59Z'))).toBe('2026-10')
  })

  test('vnDayStart: 0h giờ VN của ngày cách hôm nay n ngày', () => {
    expect(vnDayStart(0, lateUtc).toISOString()).toBe('2026-10-31T17:00:00.000Z')
    expect(vnDayStart(13, lateUtc).toISOString()).toBe('2026-10-18T17:00:00.000Z')
  })
})
