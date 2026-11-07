// setupFile của project integration: thay next/headers và createServerClient bằng bản
// đọc ngữ cảnh từ asUser() (vi.mock được hoist theo file nên phải đặt ở đây một lần).
import { vi } from 'vitest'

vi.mock('next/headers', async () => {
  const { currentContext, cookieStore } = await import('./request-context')
  return {
    cookies: async () => cookieStore(currentContext()),
    headers: async () => currentContext().headers,
  }
})

vi.mock('@/lib/supabase/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/server')>()
  const { currentContext } = await import('./request-context')
  return {
    // Người dùng cụ thể → client đã đăng nhập của họ; anon → client SSR thật, phiên lưu
    // trong kho cookie giả của ngữ cảnh (login/registerPartner đăng nhập được).
    createServerClient: () => currentContext().client ?? actual.createServerClient(),
  }
})
