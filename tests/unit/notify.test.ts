import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Cài đặt trả về từ bảng settings (giả lập adminClient).
let settingsRows: { key: string; value: unknown }[] = []
vi.mock('@/lib/supabase/admin', () => ({
  adminClient: () => ({
    from: () => ({
      select: () => ({
        in: async (_col: string, keys: string[]) => ({
          data: settingsRows.filter((r) => keys.includes(r.key)),
          error: null,
        }),
      }),
    }),
  }),
}))

const { notifyNewOrder, notifyPayoutRequest } = await import('@/lib/notify')

const order = { code: 'DH2611-0001', source: 'partner' as const, partnerName: 'Anh Ba', subtotal: 1170000, partnerPayable: null }
const fetchMock = vi.fn()

beforeEach(() => {
  settingsRows = []
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('RESEND_API_KEY', '')
  vi.stubEnv('TELEGRAM_BOT_TOKEN', '')
  vi.stubEnv('NOTIFY_FROM_EMAIL', '')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('notifyNewOrder', () => {
  test('thiếu cấu hình thì không gọi fetch', async () => {
    await notifyNewOrder(order)
    expect(fetchMock).not.toHaveBeenCalled()

    // Có key nhưng thiếu setting tương ứng (và ngược lại) → vẫn không gọi.
    vi.stubEnv('RESEND_API_KEY', 're_test')
    settingsRows = [{ key: 'telegram_chat_id', value: '-100123' }]
    await notifyNewOrder(order)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('đủ cấu hình → gửi email Resend và Telegram', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '123:abc')
    vi.stubEnv('NOTIFY_FROM_EMAIL', 'don@cuahang.vn')
    settingsRows = [
      { key: 'notify_email', value: 'chu@cuahang.vn' },
      { key: 'telegram_chat_id', value: -100123 },
    ]
    await notifyNewOrder(order)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [emailUrl, emailInit] = fetchMock.mock.calls.find(([u]) => String(u).includes('resend'))!
    expect(emailUrl).toBe('https://api.resend.com/emails')
    expect(emailInit.method).toBe('POST')
    expect(emailInit.headers.Authorization).toBe('Bearer re_test')
    const email = JSON.parse(emailInit.body)
    expect(email).toMatchObject({ from: 'don@cuahang.vn', to: ['chu@cuahang.vn'] })
    expect(email.subject).toContain('DH2611-0001')
    expect(email.text).toContain('Anh Ba')
    expect(email.text).toContain('1.170.000 đ')

    const [tgUrl, tgInit] = fetchMock.mock.calls.find(([u]) => String(u).includes('telegram'))!
    expect(tgUrl).toBe('https://api.telegram.org/bot123:abc/sendMessage')
    const tg = JSON.parse(tgInit.body)
    expect(tg.chat_id).toBe('-100123')
    expect(tg.text).toContain('DH2611-0001')
  })

  test('đơn đại lý: báo số tiền đại lý phải trả, không phải giá bán lẻ', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '123:abc')
    settingsRows = [{ key: 'telegram_chat_id', value: '-100123' }]
    await notifyNewOrder({ ...order, subtotal: 1170000, partnerPayable: 1050000 })
    const text = JSON.parse(fetchMock.mock.calls[0][1].body).text as string
    expect(text).toContain('1.050.000 đ')
    expect(text).not.toContain('1.170.000 đ')
  })

  test('đơn thử → "[THỬ]" ở đầu tiêu đề và nội dung; đơn thật không có', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '123:abc')
    settingsRows = [
      { key: 'notify_email', value: 'chu@cuahang.vn' },
      { key: 'telegram_chat_id', value: '-100123' },
    ]
    await notifyNewOrder({ ...order, isDemo: true })
    const email = JSON.parse(fetchMock.mock.calls.find(([u]) => String(u).includes('resend'))![1].body)
    const tg = JSON.parse(fetchMock.mock.calls.find(([u]) => String(u).includes('telegram'))![1].body)
    expect(email.subject).toMatch(/^\[THỬ\] /)
    expect(email.text).toMatch(/^\[THỬ\] Đơn mới DH2611-0001/)
    expect(tg.text).toMatch(/^\[THỬ\] /)
    fetchMock.mockClear()
    await notifyNewOrder(order)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text ?? '').not.toContain('[THỬ]')
  })

  test('fetch lỗi không throw', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '123:abc')
    settingsRows = [
      { key: 'notify_email', value: 'chu@cuahang.vn' },
      { key: 'telegram_chat_id', value: '-100123' },
    ]
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    fetchMock.mockResolvedValueOnce(new Response('bad', { status: 500 }))
    await expect(notifyNewOrder(order)).resolves.toBeUndefined()
    expect(err).toHaveBeenCalledTimes(2)
  })

  test('đọc cài đặt lỗi không throw', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    settingsRows = null as unknown as []
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(notifyNewOrder({ ...order, source: 'retail', partnerName: null })).resolves.toBeUndefined()
    expect(err).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('notifyPayoutRequest', () => {
  const notice = {
    partnerName: 'CTV An', phone: '0905000001', amount: 1500000,
    bankName: 'Vietcombank', bankAccount: '0123456789', bankHolder: 'NGUYEN VAN AN',
  }

  test('thiếu cấu hình thì không gọi fetch', async () => {
    await notifyPayoutRequest(notice)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('gửi email + Telegram: tên, SĐT, số tiền, ngân hàng', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '123:abc')
    settingsRows = [
      { key: 'notify_email', value: 'chu@cuahang.vn' },
      { key: 'telegram_chat_id', value: '-100123' },
    ]
    await notifyPayoutRequest(notice)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const email = JSON.parse(fetchMock.mock.calls.find(([u]) => String(u).includes('resend'))![1].body)
    expect(email.subject).toContain('Yêu cầu rút tiền')
    expect(email.subject).toContain('1.500.000 đ')
    const tg = JSON.parse(fetchMock.mock.calls.find(([u]) => String(u).includes('telegram'))![1].body)
    for (const part of ['CTV An', '0905000001', '1.500.000 đ', 'Vietcombank', '0123456789', 'NGUYEN VAN AN']) {
      expect(tg.text).toContain(part)
    }
  })

  test('đối tác thử → "[THỬ]"', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '123:abc')
    settingsRows = [{ key: 'telegram_chat_id', value: '-100123' }]
    await notifyPayoutRequest({ ...notice, isDemo: true })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toMatch(/^\[THỬ\] Yêu cầu rút tiền/)
  })

  test('fetch lỗi không throw', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '123:abc')
    settingsRows = [{ key: 'telegram_chat_id', value: '-100123' }]
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    await expect(notifyPayoutRequest(notice)).resolves.toBeUndefined()
    expect(err).toHaveBeenCalled()
  })
})
