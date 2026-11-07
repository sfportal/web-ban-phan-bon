// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { ProductTabs } from '@/components/shop/ProductTabs'

afterEach(cleanup)

const EMPTY = { benefits: null, composition: null, usage: null, crops: [] as string[], description: null }

const FULL = {
  benefits: 'Cây đẻ nhánh khỏe.\nLá xanh bền.',
  composition: 'Đạm (N) 20% – Lân (P₂O₅) 20% – Kali (K₂O) 15%',
  usage: 'Lúa: bón thúc 100–150 kg/ha.\nRau màu: 300–500 kg/ha/vụ.',
  crops: ['Lúa', 'Cà phê'],
  description: 'Sản phẩm của Bình Điền.',
}

describe('ProductTabs', () => {
  test('đủ trường → 5 tab đúng thứ tự, tab đầu đang mở', () => {
    render(<ProductTabs product={FULL} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Công dụng', 'Thành phần', 'Cách dùng', 'Cây phù hợp', 'Mô tả'])
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toContain('Cây đẻ nhánh khỏe.')
  })

  test('bấm tab → hiện nội dung tab đó; mỗi dòng công dụng/cách dùng là một mục', () => {
    render(<ProductTabs product={FULL} />)
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Cây đẻ nhánh khỏe.', 'Lá xanh bền.'])
    fireEvent.click(screen.getByRole('tab', { name: 'Cây phù hợp' }))
    expect(screen.getByRole('tab', { name: 'Cây phù hợp' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toContain('Cà phê')
    fireEvent.click(screen.getByRole('tab', { name: 'Cách dùng' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  test('chỉ có usage → đúng 1 tab "Cách dùng"', () => {
    render(<ProductTabs product={{ ...EMPTY, usage: 'Pha 20 ml cho bình 16 lít.' }} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0].textContent).toBe('Cách dùng')
    expect(screen.getByRole('tabpanel').textContent).toContain('Pha 20 ml cho bình 16 lít.')
  })

  test('tất cả rỗng/null/[] (kể cả chuỗi chỉ có khoảng trắng) → không render gì', () => {
    const { container } = render(<ProductTabs product={EMPTY} />)
    expect(container.innerHTML).toBe('')
    cleanup()
    const again = render(<ProductTabs product={{ benefits: '  ', composition: '', usage: '\n', crops: [' '], description: '' }} />)
    expect(again.container.innerHTML).toBe('')
  })

  test('cây trùng (kể cả khác khoảng trắng) chỉ hiện một lần', () => {
    render(<ProductTabs product={{ ...EMPTY, crops: ['Lúa', ' Lúa ', 'Cà phê'] }} />)
    expect(screen.getByRole('tabpanel').textContent).toBe('LúaCà phê')
  })

  test('không lộ chuỗi undefined/null', () => {
    const { container } = render(<ProductTabs product={{ ...EMPTY, composition: 'Đạm 46%' }} />)
    expect(container.innerHTML).not.toMatch(/undefined|null/)
    const full = render(<ProductTabs product={FULL} />)
    expect(full.container.innerHTML).not.toMatch(/undefined|null/)
  })
})
