import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Đăng xuất qua Route Handler thay vì Server Action: nút "Đăng xuất" là <form method="post"
// action="/dang-xuat"> thuần, nên vẫn chạy khi trang đang mở từ bản triển khai cũ (ID Server
// Action đã đổi) hoặc chưa tải xong JS. Luôn chuyển về /dang-nhap (303 → trình duyệt GET).
// signOut() lỗi (mạng, Supabase trả 5xx/429…) thì supabase-js giữ phiên: tự xóa cookie phiên
// sb-* trên phản hồi để thiết bị này vẫn đăng xuất.

const isAuthCookie = (name: string) => name.startsWith('sb-') && name.includes('-auth-token')

// Chỉ POST: GET không có handler nên Next trả 405 (link/ảnh từ trang khác không đăng xuất được người dùng).
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { error } = await createServerClient().auth.signOut()
  const response = NextResponse.redirect(new URL('/dang-nhap', request.url), 303)
  response.headers.set('Cache-Control', 'private, no-store')
  if (error) {
    for (const { name } of request.cookies.getAll()) {
      if (isAuthCookie(name)) response.cookies.set(name, '', { path: '/', maxAge: 0 })
    }
  }
  return response
}
