import { describe, expect, test } from 'vitest'
import { allowsRemoteImage, imageRemotePatterns, supabaseStoragePattern } from '@/lib/media/remote-patterns'

describe('supabaseStoragePattern', () => {
  test('chỉ đúng host của project, chỉ thư mục public', () => {
    expect(supabaseStoragePattern('https://abcd1234.supabase.co')).toEqual({
      protocol: 'https', hostname: 'abcd1234.supabase.co', pathname: '/storage/v1/object/public/**',
    })
  })
  test('URL local (placeholder CI) giữ http và cổng', () => {
    expect(supabaseStoragePattern('http://127.0.0.1:54321')).toEqual({
      protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/object/public/**',
    })
  })
  test('thiếu hoặc sai → null', () => {
    expect(supabaseStoragePattern(undefined)).toBeNull()
    expect(supabaseStoragePattern('')).toBeNull()
    expect(supabaseStoragePattern('khong-phai-url')).toBeNull()
    expect(supabaseStoragePattern('ftp://abcd.supabase.co')).toBeNull()
  })
})

test('imageRemotePatterns: Unsplash, Pexels + Supabase của project, không có wildcard', () => {
  const list = imageRemotePatterns('https://abcd1234.supabase.co')
  expect(list.map((p) => p.hostname)).toEqual(['images.unsplash.com', 'images.pexels.com', 'abcd1234.supabase.co'])
  expect(list.some((p) => p.hostname.includes('*'))).toBe(false)
  expect(imageRemotePatterns(undefined).map((p) => p.hostname)).toEqual(['images.unsplash.com', 'images.pexels.com'])
})

describe('allowsRemoteImage', () => {
  const list = imageRemotePatterns('http://127.0.0.1:54321')
  test('ảnh Unsplash/Pexels và bucket công khai của project → tối ưu được', () => {
    expect(allowsRemoteImage('https://images.unsplash.com/photo-1?w=1600', list)).toBe(true)
    expect(allowsRemoteImage('https://images.pexels.com/photos/1/a.jpeg', list)).toBe(true)
    expect(allowsRemoteImage('http://127.0.0.1:54321/storage/v1/object/public/products/a.jpg', list)).toBe(true)
  })
  test('host lạ, sai giao thức/cổng, ngoài thư mục public, URL hỏng → không', () => {
    expect(allowsRemoteImage('https://a.vn/x.jpg', list)).toBe(false)
    expect(allowsRemoteImage('http://images.unsplash.com/photo-1', list)).toBe(false)
    expect(allowsRemoteImage('http://127.0.0.1:9999/storage/v1/object/public/a.jpg', list)).toBe(false)
    expect(allowsRemoteImage('http://127.0.0.1:54321/storage/v1/object/sign/a.jpg', list)).toBe(false)
    expect(allowsRemoteImage('khong-phai-url', list)).toBe(false)
  })
})
