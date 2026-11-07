// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { OrderDraft } from '@/lib/draft/use-order-draft'

const PARTNER = 'p-1'
const KEY = `draft:v1:${PARTNER}`

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Hook = ReturnType<typeof import('@/lib/draft/use-order-draft').useOrderDraft>

/**
 * Nạp module mới (giống tải lại trang: kho trong bộ nhớ mất, chỉ còn localStorage) rồi
 * render useOrderDraft trong một component thật. `result()` trả giá trị hook mới nhất.
 */
async function mountFresh(initial?: OrderDraft) {
  vi.resetModules()
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const mod = await import('@/lib/draft/use-order-draft')
  let latest: Hook | null = null
  function Probe() {
    latest = mod.useOrderDraft(PARTNER, initial)
    return null
  }
  const el = document.createElement('div')
  const root = createRoot(el)
  await React.act(async () => root.render(React.createElement(Probe)))
  return {
    result: () => latest!,
    act: (fn: () => void) => React.act(async () => fn()),
    unmount: () => React.act(async () => root.unmount()),
  }
}

describe('draftToLines', () => {
  test('gắn farmerId theo nhóm, bỏ item qty 0, giá theo priceOf', async () => {
    const { draftToLines } = await import('@/lib/draft/use-order-draft')
    const draft: OrderDraft = {
      clientKey: 'k',
      deliveryAddress: '',
      note: '',
      groups: [
        { farmerId: 'f1', farmerName: 'A', items: [{ productId: 'p1', qty: 2 }, { productId: 'p2', qty: 0 }] },
        { farmerId: 'f2', farmerName: 'B', items: [{ productId: 'p1', qty: 1 }, { productId: 'p3', qty: 5 }] },
        { farmerId: 'f3', farmerName: 'C', items: [] },
      ],
    }
    const prices: Record<string, number> = { p1: 100, p2: 200, p3: 300 }
    expect(draftToLines(draft, (id) => prices[id])).toEqual([
      { productId: 'p1', qty: 2, farmerId: 'f1', seenSalePrice: 100 },
      { productId: 'p1', qty: 1, farmerId: 'f2', seenSalePrice: 100 },
      { productId: 'p3', qty: 5, farmerId: 'f2', seenSalePrice: 300 },
    ])
  })

  test('nhóm đại lý farmerId null', async () => {
    const { draftToLines } = await import('@/lib/draft/use-order-draft')
    const draft: OrderDraft = {
      clientKey: 'k', deliveryAddress: '', note: '',
      groups: [{ farmerId: null, farmerName: '', items: [{ productId: 'p1', qty: 3 }] }],
    }
    expect(draftToLines(draft, () => 50)).toEqual([{ productId: 'p1', qty: 3, farmerId: null, seenSalePrice: 50 }])
  })
})

describe('useOrderDraft', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  test('giữ clientKey và nội dung qua lần tải lại từ storage; reset() đổi clientKey', async () => {
    const a = await mountFresh()
    const key = a.result().draft!.clientKey
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    await a.act(() => {
      const g = a.result().addGroup({ id: 'f1', name: 'Anh Ba' })
      a.result().setQty(g, 'p1', 3)
      a.result().setDelivery('Ea Kar')
      a.result().setNote('giao sáng')
    })
    expect(a.result().addGroup({ id: 'f1', name: 'Anh Ba' })).toBe(0)
    await a.unmount()

    const b = await mountFresh()
    expect(b.result().draft).toEqual({
      clientKey: key,
      groups: [{ farmerId: 'f1', farmerName: 'Anh Ba', items: [{ productId: 'p1', qty: 3 }] }],
      deliveryAddress: 'Ea Kar',
      note: 'giao sáng',
    })

    await b.act(() => b.result().reset())
    const after = b.result().draft!
    expect(after.clientKey).not.toBe(key)
    expect(after.groups).toEqual([])
    expect(JSON.parse(localStorage.getItem(KEY)!).clientKey).toBe(after.clientKey)
    await b.unmount()
  })

  test('setQty 0 bỏ sản phẩm; removeGroup bỏ nhóm', async () => {
    const h = await mountFresh()
    await h.act(() => {
      h.result().addGroup({ id: 'f1', name: 'A' })
      h.result().addGroup({ id: 'f2', name: 'B' })
      h.result().setQty(0, 'p1', 2)
      h.result().setQty(0, 'p2', 1)
      h.result().setQty(0, 'p1', 0)
      h.result().removeGroup(1)
    })
    expect(h.result().draft!.groups).toEqual([{ farmerId: 'f1', farmerName: 'A', items: [{ productId: 'p2', qty: 1 }] }])
    await h.unmount()
  })

  test('initial thay đơn nháp hiện tại', async () => {
    const initial: OrderDraft = {
      clientKey: '11111111-1111-4111-8111-111111111111', deliveryAddress: 'Krông Pắc', note: '',
      groups: [{ farmerId: 'f9', farmerName: 'Chị Lan', items: [{ productId: 'p5', qty: 4 }] }],
    }
    const h = await mountFresh(initial)
    expect(h.result().draft).toEqual(initial)
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(initial)
    await h.unmount()
  })

  test('dữ liệu hỏng trong storage → đơn nháp mới', async () => {
    localStorage.setItem(KEY, '{not json')
    const h = await mountFresh()
    expect(h.result().draft!.groups).toEqual([])
    await h.unmount()
  })

  test('storage ném lỗi vẫn chạy trong bộ nhớ', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const h = await mountFresh()
    await h.act(() => {
      const g = h.result().addGroup({ id: null, name: '' })
      h.result().setQty(g, 'p1', 2)
    })
    expect(h.result().draft!.groups).toEqual([{ farmerId: null, farmerName: '', items: [{ productId: 'p1', qty: 2 }] }])
    await h.unmount()
  })
})
