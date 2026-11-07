// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { Badge, Button, Card, EmptyState, Field, RemoteImage, SectionHeader, StatCard } from '@/components/ui'

afterEach(cleanup)

describe('Button', () => {
  test('có href → thẻ a', () => {
    render(<Button href="/gio-hang">Xem giỏ</Button>)
    const link = screen.getByRole('link', { name: 'Xem giỏ' })
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/gio-hang')
  })
  test('không href → button type=button mặc định, cao 44px', () => {
    render(<Button>Lưu</Button>)
    const btn = screen.getByRole('button', { name: 'Lưu' })
    expect(btn.getAttribute('type')).toBe('button')
    expect(btn.className).toContain('h-11')
  })
  test('size lg cao 52px', () => {
    render(<Button size="lg">Đặt hàng</Button>)
    expect(screen.getByRole('button', { name: 'Đặt hàng' }).className).toContain('h-[52px]')
  })
  test('href + disabled → span không bấm, không focus được', () => {
    render(<Button href="/dat-hang" disabled>Đặt hàng</Button>)
    const el = screen.getByRole('link', { name: 'Đặt hàng' })
    expect(el.tagName).toBe('SPAN')
    expect(el.getAttribute('aria-disabled')).toBe('true')
    expect(el.hasAttribute('href')).toBe(false)
    expect(el.hasAttribute('tabindex')).toBe(false)
    expect(el.className).toContain('h-11')
  })
  test('variant danger và type submit giữ nguyên', () => {
    render(<Button variant="danger" type="submit">Xóa</Button>)
    const btn = screen.getByRole('button', { name: 'Xóa' })
    expect(btn.getAttribute('type')).toBe('submit')
    expect(btn.className).toContain('bg-red-700')
  })
})

describe('RemoteImage', () => {
  test('lỗi tải ảnh → bỏ img, hiện khung dự phòng', () => {
    const { container } = render(
      <RemoteImage src="https://images.unsplash.com/photo-1" alt="Ruộng lúa" className="aspect-video" sizes="100vw" />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(screen.queryByTestId('image-fallback')).toBeNull()
    fireEvent.error(img!)
    expect(container.querySelector('img')).toBeNull()
    const fb = screen.getByTestId('image-fallback')
    expect(fb.getAttribute('aria-label')).toBe('Ruộng lúa')
    expect(container.firstElementChild!.className).toContain('aspect-video')
  })
})

describe('Field', () => {
  test('gắn aria-invalid, hiện lỗi và liên kết aria-describedby', () => {
    render(
      <Field label="Số điện thoại" error="Số điện thoại chưa đúng" hint="10 số">
        <input name="phone" />
      </Field>,
    )
    const input = screen.getByLabelText('Số điện thoại')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ')
    const texts = ids.map((id) => document.getElementById(id)?.textContent)
    expect(texts).toContain('Số điện thoại chưa đúng')
    expect(texts).toContain('10 số')
    expect(screen.getByText('Số điện thoại chưa đúng').getAttribute('role')).toBe('alert')
  })
  test('không lỗi → không aria-invalid', () => {
    render(<Field label="Tên"><input name="name" /></Field>)
    expect(screen.getByLabelText('Tên').hasAttribute('aria-invalid')).toBe(false)
  })
})

describe('thành phần hiển thị', () => {
  test('Card, Badge, SectionHeader, EmptyState, StatCard render nội dung', () => {
    render(
      <>
        <Card as="section">Nội dung thẻ</Card>
        <Badge tone="yellow">Khuyến mãi</Badge>
        <SectionHeader title="Sản phẩm nổi bật" subtitle="Giá tham khảo" action={<a href="/x">Xem tất cả</a>} />
        <EmptyState title="Chưa có đơn hàng" description="Đơn mới sẽ hiện ở đây." />
        <StatCard label="Doanh thu tháng" value="12.000.000 đ" hint="Tạm tính" />
      </>,
    )
    expect(screen.getByText('Nội dung thẻ').tagName).toBe('SECTION')
    expect(screen.getByText('Khuyến mãi').className).toContain('bg-accent-soft')
    expect(screen.getByRole('heading', { name: 'Sản phẩm nổi bật' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Xem tất cả' })).toBeTruthy()
    expect(screen.getByText('Chưa có đơn hàng')).toBeTruthy()
    expect(screen.getByText('12.000.000 đ')).toBeTruthy()
  })
})
