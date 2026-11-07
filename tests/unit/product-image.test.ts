import { describe, expect, test } from 'vitest'
import { imageExtension, parseImageLink, validateImage } from '@/lib/admin/image'

describe('validateImage', () => {
  test('chấp nhận jpg/png/webp ≤ 2MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateImage({ type, size: 1000 })).toBeNull()
    }
    expect(validateImage({ type: 'image/png', size: 2 * 1024 * 1024 })).toBeNull()
  })
  test('từ chối quá 2MB, sai định dạng, file rỗng', () => {
    expect(validateImage({ type: 'image/png', size: 2 * 1024 * 1024 + 1 })).toMatch(/2MB/)
    expect(validateImage({ type: 'image/gif', size: 10 })).toMatch(/JPG|PNG|WebP/i)
    expect(validateImage({ type: 'application/pdf', size: 10 })).not.toBeNull()
    expect(validateImage({ type: 'image/png', size: 0 })).not.toBeNull()
  })
  test('đuôi file theo loại', () => {
    expect(imageExtension('image/jpeg')).toBe('jpg')
    expect(imageExtension('image/png')).toBe('png')
    expect(imageExtension('image/webp')).toBe('webp')
  })
})

describe('parseImageLink', () => {
  test('chỉ nhận http/https', () => {
    expect(parseImageLink(' https://a.vn/x.jpg ')).toBe('https://a.vn/x.jpg')
    expect(parseImageLink('http://a.vn/x.jpg')).toBe('http://a.vn/x.jpg')
    expect(parseImageLink('')).toBeNull()
    expect(() => parseImageLink('javascript:alert(1)')).toThrow()
    expect(() => parseImageLink('abc')).toThrow()
  })
})
