// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const nav = vi.hoisted(() => ({ pathname: '/admin' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))

import { AdminNav } from '@/components/admin/AdminNav'

afterEach(cleanup)
beforeEach(() => { nav.pathname = '/admin' })

const menu = () => screen.getByRole('navigation', { name: 'Khu quản trị' })

describe('AdminNav', () => {
  test('nhân viên (staff) không thấy "Cài đặt"', () => {
    render(<AdminNav role="staff" />)
    expect(within(menu()).queryByRole('link', { name: 'Cài đặt' })).toBeNull()
    expect(within(menu()).queryByRole('link', { name: 'Dữ liệu thử' })).toBeNull()
    expect(within(menu()).getByRole('link', { name: 'Đơn hàng' })).toBeTruthy()
  })

  test('admin thấy "Cài đặt", "Dữ liệu thử" và đủ 11 mục', () => {
    render(<AdminNav role="admin" />)
    expect(within(menu()).getByRole('link', { name: 'Cài đặt' }).getAttribute('href')).toBe('/admin/cai-dat')
    expect(within(menu()).getByRole('link', { name: 'Dữ liệu thử' }).getAttribute('href')).toBe('/admin/du-lieu-thu')
    expect(within(menu()).getAllByRole('link')).toHaveLength(11)
  })

  test('mục khớp pathname (cả trang con) có aria-current="page", mục khác không', () => {
    nav.pathname = '/admin/san-pham/abc'
    render(<AdminNav role="admin" />)
    const current = within(menu()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page')
    expect(current.map((a) => a.textContent)).toEqual(['Sản phẩm'])
  })

  test('"Tổng quan" chỉ sáng khi đúng /admin', () => {
    render(<AdminNav role="admin" />)
    expect(within(menu()).getByRole('link', { name: 'Tổng quan' }).getAttribute('aria-current')).toBe('page')
    cleanup()
    nav.pathname = '/admin/don-hang'
    render(<AdminNav role="admin" />)
    expect(within(menu()).getByRole('link', { name: 'Tổng quan' }).getAttribute('aria-current')).toBeNull()
  })

  test('mỗi mục có icon; nút Menu mở/đóng danh sách trên điện thoại', () => {
    render(<AdminNav role="admin" />)
    for (const a of within(menu()).getAllByRole('link')) expect(a.querySelector('svg')).not.toBeNull()
    const toggle = screen.getByRole('button', { name: 'Mở menu' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Đóng menu' }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(within(menu()).getByRole('link', { name: 'Sản phẩm' }))
    expect(screen.getByRole('button', { name: 'Mở menu' }).getAttribute('aria-expanded')).toBe('false')
  })
})
