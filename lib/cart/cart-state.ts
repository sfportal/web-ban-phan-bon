// Phần thuần của giỏ hàng (không phụ thuộc React): reducer và đọc/ghi localStorage.

export type CartItem = { productId: string; qty: number }

export type CartAction =
  | { type: 'add'; productId: string; qty: number }
  | { type: 'setQty'; productId: string; qty: number }
  | { type: 'remove'; productId: string }
  | { type: 'clear' }

export const CART_KEY = 'cart:v1'
export const MAX_QTY = 9999

function validQty(qty: number): boolean {
  return Number.isInteger(qty) && qty >= 1
}

export function cartReducer(items: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'add': {
      if (!validQty(action.qty)) return items
      const found = items.find((i) => i.productId === action.productId)
      if (!found) return [...items, { productId: action.productId, qty: Math.min(action.qty, MAX_QTY) }]
      return items.map((i) =>
        i.productId === action.productId ? { ...i, qty: Math.min(i.qty + action.qty, MAX_QTY) } : i,
      )
    }
    case 'setQty': {
      if (!Number.isInteger(action.qty)) return items
      if (action.qty < 1) return items.filter((i) => i.productId !== action.productId)
      return items.map((i) =>
        i.productId === action.productId ? { ...i, qty: Math.min(action.qty, MAX_QTY) } : i,
      )
    }
    case 'remove':
      return items.filter((i) => i.productId !== action.productId)
    case 'clear':
      return []
  }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** Đọc giỏ từ storage; dữ liệu hỏng hoặc storage ném lỗi → giỏ rỗng. */
export function loadItems(storage: StorageLike | null): CartItem[] {
  try {
    const raw = storage?.getItem(CART_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const items: CartItem[] = []
    for (const e of parsed) {
      if (typeof e !== 'object' || e === null) continue
      const { productId, qty } = e as Record<string, unknown>
      if (typeof productId !== 'string' || typeof qty !== 'number' || !validQty(qty) || seen.has(productId)) continue
      seen.add(productId)
      items.push({ productId, qty: Math.min(qty, MAX_QTY) })
    }
    return items
  } catch {
    return []
  }
}

/** Ghi giỏ vào storage; trả false nếu không ghi được (giỏ vẫn giữ trong bộ nhớ). */
export function saveItems(storage: StorageLike | null, items: CartItem[]): boolean {
  try {
    if (!storage) return false
    storage.setItem(CART_KEY, JSON.stringify(items))
    return true
  } catch {
    return false
  }
}
