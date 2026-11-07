import { describe, expect, test } from 'vitest'
import { normalizePhone, phoneToEmail } from '@/lib/phone'
import { formatVnd } from '@/lib/format'

describe('phone', () => {
  test.each([
    ['0912345678', '0912345678'], ['+84 912 345 678', '0912345678'],
    ['84912345678', '0912345678'], ['0912.345.678', '0912345678'],
    ['(091) 234-5678', '0912345678'], ['02838123456', '02838123456'],
  ])('normalizePhone(%s)', (i, o) => expect(normalizePhone(i)).toBe(o))
  test.each(['123', 'abc0912345678', '', '091234567890', '1912345678'])(
    'normalizePhone từ chối %s', (i) => expect(normalizePhone(i)).toBeNull())
  test('phoneToEmail', () => expect(phoneToEmail('+84912345678')).toBe('0912345678@partner.local'))
  test('phoneToEmail sai', () => expect(() => phoneToEmail('12')).toThrow('invalid_phone'))
  test('formatVnd', () => expect(formatVnd(350000)).toBe('350.000 đ'))
})
