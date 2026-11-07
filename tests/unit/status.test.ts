import { describe, expect, test } from 'vitest'
import { canTransition } from '@/lib/orders/status'

describe('status', () => {
  test('partner chỉ hủy được đơn mới', () => {
    expect(canTransition('new', 'cancelled', 'partner')).toBe(true)
    expect(canTransition('new', 'confirmed', 'partner')).toBe(false)
    expect(canTransition('confirmed', 'cancelled', 'partner')).toBe(false)
  })
  test('staff theo sơ đồ', () => {
    expect(canTransition('delivered', 'paid', 'staff')).toBe(true)
    expect(canTransition('paid', 'returned', 'staff')).toBe(true)
    expect(canTransition('paid', 'cancelled', 'staff')).toBe(false)
    expect(canTransition('new', 'paid', 'staff')).toBe(false)
  })
})
