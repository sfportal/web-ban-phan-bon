// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { AuthShell } from '@/components/auth/AuthShell'
import { IMAGES } from '@/lib/media/images'

afterEach(cleanup)

const BENEFITS = ['Hoa hồng theo từng đơn', 'Lên đơn trên điện thoại trong 1 phút', 'Theo dõi đơn và hoa hồng minh bạch']

describe('AuthShell', () => {
  test('tiêu đề là h1, có phụ đề và nội dung form', () => {
    render(
      <AuthShell title="Đăng nhập" subtitle="Dành cho cộng tác viên và đại lý.">
        <form aria-label="Form thử" />
      </AuthShell>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeTruthy()
    expect(screen.getByText('Dành cho cộng tác viên và đại lý.')).toBeTruthy()
    expect(screen.getByRole('form', { name: 'Form thử' })).toBeTruthy()
  })

  test('đủ 3 lợi ích CTV, mỗi lợi ích một mục danh sách', () => {
    render(<AuthShell title="Đăng ký">x</AuthShell>)
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    for (const b of BENEFITS) {
      expect(screen.getByText(b)).toBeTruthy()
      expect(items).toContain(b)
    }
  })

  test('ảnh khu đăng nhập có alt từ IMAGES.auth', () => {
    render(<AuthShell title="Đăng nhập">x</AuthShell>)
    const img = screen.getByRole('img', { name: IMAGES.auth.alt })
    expect(img.getAttribute('src')).toContain(encodeURIComponent(IMAGES.auth.url.split('?')[0]))
  })

  test('không có phụ đề thì không render đoạn trống', () => {
    const { container } = render(<AuthShell title="Chờ duyệt">x</AuthShell>)
    expect(container.querySelector('h1 + p')).toBeNull()
  })

  test('có liên kết về trang chủ cửa hàng', () => {
    render(<AuthShell title="Đăng nhập">x</AuthShell>)
    expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === '/')).toBe(true)
  })
})
