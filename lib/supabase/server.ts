import { createServerClient as createSsrClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

// Client theo phiên người dùng (cookie) cho Server Components, Server Actions, Route Handlers.
// Mọi truy vấn chạy dưới RLS của người dùng đang đăng nhập (hoặc anon).
export function createServerClient(): SupabaseClient<Database> {
  return createSsrClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: async () => (await cookies()).getAll(),
        setAll: async (toSet) => {
          const store = await cookies()
          try {
            for (const { name, value, options } of toSet) store.set(name, value, options)
          } catch {
            // Server Component không ghi được cookie; middleware sẽ làm mới phiên.
          }
        },
      },
    },
  )
}
