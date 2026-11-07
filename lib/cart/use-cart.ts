'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { cartReducer, loadItems, saveItems, CART_KEY, type CartAction, type CartItem } from './cart-state'

// Kho giỏ hàng dùng chung cho mọi component trong trang. Lưu localStorage (key `cart:v1`);
// nếu localStorage lỗi (chế độ riêng tư, hết dung lượng...) thì giỏ vẫn giữ trong bộ nhớ.
const EMPTY: CartItem[] = []
let items: CartItem[] = EMPTY
let loaded = false
const listeners = new Set<() => void>()

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function emit() {
  for (const l of listeners) l()
}

function ensureLoaded() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  items = loadItems(storage())
}

function dispatch(action: CartAction) {
  ensureLoaded()
  const next = cartReducer(items, action)
  if (next === items) return
  items = next
  saveItems(storage(), items)
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== CART_KEY && e.key !== null) return
    items = loadItems(storage())
    emit()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot(): CartItem[] {
  ensureLoaded()
  return items
}

function getServerSnapshot(): CartItem[] {
  return EMPTY
}

export function useCart() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const add = useCallback((productId: string, qty = 1) => dispatch({ type: 'add', productId, qty }), [])
  const setQty = useCallback((productId: string, qty: number) => dispatch({ type: 'setQty', productId, qty }), [])
  const remove = useCallback((productId: string) => dispatch({ type: 'remove', productId }), [])
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])
  return useMemo(() => ({ items: current, add, setQty, remove, clear }), [current, add, setQty, remove, clear])
}
