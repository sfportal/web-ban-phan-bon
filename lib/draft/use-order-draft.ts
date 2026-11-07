'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { SeenLine } from '@/lib/orders/submit'

// Đơn nháp của đối tác: một hoặc nhiều nhóm (mỗi nhóm một nông dân; đại lý chỉ có một
// nhóm farmerId = null). Lưu localStorage key `draft:v1:<partnerId>` để mất mạng / tải lại
// trang không mất đơn; storage lỗi (chế độ riêng tư, hết dung lượng...) thì giữ trong bộ nhớ.

export type DraftItem = { productId: string; qty: number }
export type DraftGroup = { farmerId: string | null; farmerName: string; items: DraftItem[] }
export type OrderDraft = { clientKey: string; groups: DraftGroup[]; deliveryAddress: string; note: string }

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export const MAX_DRAFT_QTY = 9999
export const draftKey = (partnerId: string) => `draft:v1:${partnerId}`

/** UUID v4 cho client_key; crypto.randomUUID chỉ có trong secure context (https/localhost). */
function newClientKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function newDraft(): OrderDraft {
  return { clientKey: newClientKey(), groups: [], deliveryAddress: '', note: '' }
}

/** Các dòng gửi lên server: mỗi item qty > 0 thành một dòng gắn farmerId của nhóm. */
export function draftToLines(draft: OrderDraft, priceOf: (id: string) => number): SeenLine[] {
  return draft.groups.flatMap((g) =>
    g.items
      .filter((i) => i.qty > 0)
      .map((i) => ({ productId: i.productId, qty: i.qty, farmerId: g.farmerId, seenSalePrice: priceOf(i.productId) })),
  )
}

// Đọc / ghi storage ----------------------------------------------------------------

const isStr = (v: unknown): v is string => typeof v === 'string'

function parseDraft(raw: string): OrderDraft | null {
  const d: unknown = JSON.parse(raw)
  if (typeof d !== 'object' || d === null) return null
  const { clientKey, groups, deliveryAddress, note } = d as Record<string, unknown>
  if (!isStr(clientKey) || !clientKey || !Array.isArray(groups)) return null
  const clean: DraftGroup[] = []
  for (const g of groups) {
    if (typeof g !== 'object' || g === null) continue
    const { farmerId, farmerName, items } = g as Record<string, unknown>
    if (!(farmerId === null || isStr(farmerId)) || !Array.isArray(items)) continue
    const seen = new Set<string>()
    const okItems: DraftItem[] = []
    for (const it of items) {
      if (typeof it !== 'object' || it === null) continue
      const { productId, qty } = it as Record<string, unknown>
      if (!isStr(productId) || typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || seen.has(productId)) continue
      seen.add(productId)
      okItems.push({ productId, qty: Math.min(qty, MAX_DRAFT_QTY) })
    }
    clean.push({ farmerId, farmerName: isStr(farmerName) ? farmerName : '', items: okItems })
  }
  return {
    clientKey,
    groups: clean,
    deliveryAddress: isStr(deliveryAddress) ? deliveryAddress : '',
    note: isStr(note) ? note : '',
  }
}

/** Đọc đơn nháp; không có, hỏng, hoặc storage ném lỗi → null. */
export function loadDraft(storage: StorageLike | null, partnerId: string): OrderDraft | null {
  try {
    const raw = storage?.getItem(draftKey(partnerId))
    return raw ? parseDraft(raw) : null
  } catch {
    return null
  }
}

/** Ghi đơn nháp; trả false nếu không ghi được (vẫn giữ trong bộ nhớ). */
export function saveDraft(storage: StorageLike | null, partnerId: string, draft: OrderDraft): boolean {
  try {
    if (!storage) return false
    storage.setItem(draftKey(partnerId), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

// Kho theo partnerId (dùng chung cho mọi component trong trang) -----------------------

type Store = { get(): OrderDraft; set(d: OrderDraft): void; subscribe(l: () => void): () => void }
const stores = new Map<string, Store>()
// Bản `initial` (đặt lại từ đơn cũ) đã nạp, theo clientKey: chỉ nạp một lần.
const appliedInitial = new Set<string>()

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function storeFor(partnerId: string): Store {
  let s = stores.get(partnerId)
  if (s) return s
  let current: OrderDraft | null = null
  const listeners = new Set<() => void>()
  const set = (d: OrderDraft) => {
    current = d
    saveDraft(storage(), partnerId, d)
    for (const l of listeners) l()
  }
  s = {
    get() {
      if (!current) {
        const loaded = loadDraft(storage(), partnerId)
        current = loaded ?? newDraft()
        if (!loaded) saveDraft(storage(), partnerId, current)
      }
      return current
    },
    set,
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
  stores.set(partnerId, s)
  return s
}

const serverSnapshot = () => null

/**
 * Đơn nháp của đối tác `partnerId`. `draft` là null khi render phía server / trước hydrate.
 * `initial` (ví dụ "Đặt lại" từ đơn cũ) thay đơn nháp hiện tại, mỗi clientKey một lần.
 */
export function useOrderDraft(partnerId: string, initial?: OrderDraft) {
  const store = useMemo(() => storeFor(partnerId), [partnerId])
  const draft = useSyncExternalStore(store.subscribe, store.get, serverSnapshot)

  useEffect(() => {
    if (!initial || appliedInitial.has(initial.clientKey)) return
    appliedInitial.add(initial.clientKey)
    store.set(initial)
  }, [initial, store])

  const update = useCallback((fn: (d: OrderDraft) => OrderDraft) => store.set(fn(store.get())), [store])

  /** Thêm nhóm cho nông dân (đã có thì không thêm); trả chỉ số nhóm. */
  const addGroup = useCallback(
    (farmer: { id: string | null; name: string }): number => {
      const d = store.get()
      const found = d.groups.findIndex((g) => g.farmerId === farmer.id)
      if (found >= 0) return found
      store.set({ ...d, groups: [...d.groups, { farmerId: farmer.id, farmerName: farmer.name, items: [] }] })
      return d.groups.length
    },
    [store],
  )

  /** Đặt số lượng; qty < 1 thì bỏ sản phẩm khỏi nhóm. */
  const setQty = useCallback(
    (groupIdx: number, productId: string, qty: number) => {
      if (!Number.isInteger(qty)) return
      update((d) => {
        const g = d.groups[groupIdx]
        if (!g) return d
        const n = Math.min(qty, MAX_DRAFT_QTY)
        const has = g.items.some((i) => i.productId === productId)
        const items =
          n < 1
            ? g.items.filter((i) => i.productId !== productId)
            : has
              ? g.items.map((i) => (i.productId === productId ? { ...i, qty: n } : i))
              : [...g.items, { productId, qty: n }]
        return { ...d, groups: d.groups.map((x, i) => (i === groupIdx ? { ...x, items } : x)) }
      })
    },
    [update],
  )

  const removeGroup = useCallback(
    (idx: number) => update((d) => ({ ...d, groups: d.groups.filter((_, i) => i !== idx) })),
    [update],
  )
  const setDelivery = useCallback((s: string) => update((d) => ({ ...d, deliveryAddress: s })), [update])
  const setNote = useCallback((s: string) => update((d) => ({ ...d, note: s })), [update])
  /** Bắt đầu đơn mới (clientKey mới). */
  const reset = useCallback(() => store.set(newDraft()), [store])

  return { draft, addGroup, setQty, removeGroup, setDelivery, setNote, reset }
}
