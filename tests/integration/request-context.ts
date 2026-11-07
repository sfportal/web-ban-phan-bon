// Ngữ cảnh "request" giả cho Server Action trong test tích hợp: client Supabase của
// người dùng hiện tại, kho cookie trong bộ nhớ và header. `asUser()` (helpers.ts) đặt
// ngữ cảnh; các mock trong setup.ts (next/headers, @/lib/supabase/server) đọc nó.
import { AsyncLocalStorage } from 'node:async_hooks'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export type RequestContext = {
  /** Client của người dùng đã đăng nhập; null = anon (phiên lưu trong `cookies`). */
  client: SupabaseClient<Database> | null
  cookies: Map<string, string>
  headers: Headers
}

export const requestContext = new AsyncLocalStorage<RequestContext>()

export function currentContext(): RequestContext {
  const ctx = requestContext.getStore()
  if (!ctx) throw new Error('Server Action/guard phải được gọi bên trong asUser() trong test')
  return ctx
}

type CookieOptions = { maxAge?: number; expires?: Date | number | string }
type CookieInit = { name: string; value: string } & CookieOptions

function expired(o: CookieOptions | undefined): boolean {
  if (!o) return false
  if (o.maxAge !== undefined && o.maxAge <= 0) return true
  return o.expires !== undefined && new Date(o.expires).getTime() <= Date.now()
}

/** Kho cookie tối thiểu theo API `cookies()` của next/headers. */
export function cookieStore(ctx: RequestContext) {
  const jar = ctx.cookies
  const entry = (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined)
  return {
    get: (name: string | { name: string }) => entry(typeof name === 'string' ? name : name.name),
    getAll: (name?: string) =>
      name === undefined ? [...jar].map(([n, value]) => ({ name: n, value })) : [entry(name)].filter((c) => c !== undefined),
    has: (name: string) => jar.has(name),
    set(nameOrInit: string | CookieInit, value?: string, options?: CookieOptions) {
      const c = typeof nameOrInit === 'string' ? { name: nameOrInit, value: value ?? '', ...options } : nameOrInit
      if (expired(c)) jar.delete(c.name)
      else jar.set(c.name, c.value)
      return this
    },
    delete(name: string | { name: string }) {
      jar.delete(typeof name === 'string' ? name : name.name)
      return this
    },
    get size() {
      return jar.size
    },
  }
}
