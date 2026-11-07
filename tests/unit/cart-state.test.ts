import { describe, expect, test } from 'vitest'
import { CART_KEY, cartReducer, loadItems, saveItems } from '@/lib/cart/cart-state'

describe('cartReducer', () => {
  test('add thêm mới và cộng dồn', () => {
    let s = cartReducer([], { type: 'add', productId: 'a', qty: 2 })
    s = cartReducer(s, { type: 'add', productId: 'b', qty: 1 })
    s = cartReducer(s, { type: 'add', productId: 'a', qty: 3 })
    expect(s).toEqual([{ productId: 'a', qty: 5 }, { productId: 'b', qty: 1 }])
  })
  test('add bỏ qua số lượng không hợp lệ', () => {
    for (const qty of [0, -1, 1.5, NaN]) expect(cartReducer([], { type: 'add', productId: 'a', qty })).toEqual([])
  })
  test('setQty đặt lại số lượng; <1 thì xóa dòng', () => {
    const s = [{ productId: 'a', qty: 2 }, { productId: 'b', qty: 1 }]
    expect(cartReducer(s, { type: 'setQty', productId: 'a', qty: 7 })).toEqual([{ productId: 'a', qty: 7 }, { productId: 'b', qty: 1 }])
    expect(cartReducer(s, { type: 'setQty', productId: 'a', qty: 0 })).toEqual([{ productId: 'b', qty: 1 }])
    expect(cartReducer(s, { type: 'setQty', productId: 'a', qty: 1.5 })).toBe(s)
  })
  test('giới hạn số lượng tối đa', () => {
    expect(cartReducer([], { type: 'add', productId: 'a', qty: 99999 })).toEqual([{ productId: 'a', qty: 9999 }])
  })
  test('remove và clear', () => {
    const s = [{ productId: 'a', qty: 2 }, { productId: 'b', qty: 1 }]
    expect(cartReducer(s, { type: 'remove', productId: 'a' })).toEqual([{ productId: 'b', qty: 1 }])
    expect(cartReducer(s, { type: 'clear' })).toEqual([])
  })
})

describe('loadItems / saveItems', () => {
  const throwing = {
    getItem: () => { throw new Error('denied') },
    setItem: () => { throw new Error('denied') },
  }
  test('storage ném lỗi → giỏ rỗng / ghi trả false, không ném', () => {
    expect(loadItems(throwing)).toEqual([])
    expect(saveItems(throwing, [{ productId: 'a', qty: 1 }])).toBe(false)
  })
  test('không có storage', () => {
    expect(loadItems(null)).toEqual([])
    expect(saveItems(null, [])).toBe(false)
  })
  test('ghi rồi đọc lại', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
    const items = [{ productId: 'a', qty: 2 }]
    expect(saveItems(storage, items)).toBe(true)
    expect(data.has(CART_KEY)).toBe(true)
    expect(loadItems(storage)).toEqual(items)
  })
  test('dữ liệu hỏng bị loại', () => {
    const mk = (raw: string) => ({ getItem: () => raw, setItem: () => {} })
    expect(loadItems(mk('không phải json'))).toEqual([])
    expect(loadItems(mk('{"a":1}'))).toEqual([])
    expect(loadItems(mk(JSON.stringify([
      { productId: 'a', qty: 2 }, { productId: 'a', qty: 3 }, { productId: 'b', qty: 0 },
      { productId: 'c', qty: 'x' }, null, { productId: 5, qty: 1 },
    ])))).toEqual([{ productId: 'a', qty: 2 }])
  })
})
