// Nguồn ảnh ngoài cho next/image (images.remotePatterns). Dùng trong next.config.ts nên chỉ là hàm thuần.

export type RemotePattern = { protocol: 'http' | 'https'; hostname: string; port?: string; pathname: string }

const STOCK_HOSTS = ['images.unsplash.com', 'images.pexels.com']

/**
 * Bucket công khai của đúng project Supabase đang dùng (lấy host từ NEXT_PUBLIC_SUPABASE_URL),
 * không mở cho mọi *.supabase.co. URL thiếu/sai thì không thêm mục nào.
 */
export function supabaseStoragePattern(supabaseUrl: string | undefined): RemotePattern | null {
  if (!supabaseUrl) return null
  let url: URL
  try {
    url = new URL(supabaseUrl)
  } catch {
    return null
  }
  const protocol = url.protocol.replace(':', '')
  if (protocol !== 'http' && protocol !== 'https') return null
  return {
    protocol,
    hostname: url.hostname,
    ...(url.port ? { port: url.port } : {}),
    pathname: '/storage/v1/object/public/**',
  }
}

export function imageRemotePatterns(supabaseUrl: string | undefined): RemotePattern[] {
  const storage = supabaseStoragePattern(supabaseUrl)
  return [
    ...STOCK_HOSTS.map((hostname): RemotePattern => ({ protocol: 'https', hostname, pathname: '/**' })),
    ...(storage ? [storage] : []),
  ]
}
