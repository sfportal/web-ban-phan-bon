import { execFileSync } from 'node:child_process'
import { ADMIN } from './helpers'

// Trước mỗi lần chạy E2E: dữ liệu sạch (schema public + seed) và tài khoản admin cố định.
// auth.users không bị xóa qua db:reset nên create-staff chỉ đặt lại mật khẩu/vai trò.
export default function globalSetup() {
  const run = (args: string[]) => execFileSync('npx', args, { stdio: 'inherit' })
  run(['tsx', 'scripts/stack/db-reset.ts'])
  run(['tsx', 'scripts/create-staff.ts', ADMIN.phone, ADMIN.password, 'admin'])
}
