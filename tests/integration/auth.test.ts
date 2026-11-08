import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { afterAll, beforeEach, describe, expect, test } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as logoutRoute, GET as logoutRouteGet } from '@/app/dang-xuat/route'
import { login, registerPartner } from '@/lib/auth/actions'
import { requirePartner, requireStaff } from '@/lib/auth/guards'
import { createServerClient } from '@/lib/supabase/server'
import {
  adminClient,
  anonClient,
  asUser,
  createPartner,
  createStaff,
  randomPhone,
  redirectTarget,
  resetData,
} from './helpers'

const TEST_PASSWORD = 'mat-khau-test-123' // mật khẩu của createPartner/createStaff

function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

async function partnerByPhone(phone: string) {
  const { data } = await adminClient().from('partners').select().eq('phone', phone).maybeSingle().throwOnError()
  return data
}

const valid = {
  phone: '+84 912 000 111', name: 'Anh Ba', region: 'Đắk Lắk',
  delivery_address: 'Buôn Ma Thuột', password: '12345678',
}

beforeEach(resetData)
afterAll(resetData)

describe('registerPartner', () => {
  test('đăng ký bằng SĐT dạng +84 tạo partner pending với SĐT chuẩn hóa', async () => {
    expect(await asUser(null, () => registerPartner(fd(valid)))).toEqual({ ok: true })
    expect(await partnerByPhone('0912000111')).toMatchObject({
      status: 'pending', name: 'Anh Ba', region: 'Đắk Lắk', delivery_address: 'Buôn Ma Thuột', tier_id: null,
    })
  })

  test('đăng ký xong thì đã đăng nhập (phiên trong cookie) và guard đưa về /cho-duyet', async () => {
    await asUser(null, async () => {
      expect(await registerPartner(fd(valid))).toEqual({ ok: true })
      const { data } = await createServerClient().auth.getUser()
      expect(data.user?.email).toBe('0912000111@partner.local')
      expect(await redirectTarget(requirePartner())).toBe('/cho-duyet')
    })
  })

  test('đăng ký trùng SĐT', async () => {
    expect(await asUser(null, () => registerPartner(fd(valid)))).toEqual({ ok: true })
    expect(await asUser(null, () => registerPartner(fd({ ...valid, phone: '0912 000 111' }))))
      .toEqual({ error: 'phone_taken' })
  })

  test('SĐT sai, mật khẩu ngắn, thiếu trường', async () => {
    expect(await asUser(null, () => registerPartner(fd({ ...valid, phone: '12345' }))))
      .toEqual({ error: 'invalid_phone' })
    expect(await asUser(null, () => registerPartner(fd({ ...valid, password: '1234567' }))))
      .toEqual({ error: 'weak_password' })
    expect(await asUser(null, () => registerPartner(fd({ ...valid, region: '  ' }))))
      .toEqual({ error: 'missing_fields' })
    const noName = fd(valid)
    noName.delete('name')
    expect(await asUser(null, () => registerPartner(noName))).toEqual({ error: 'missing_fields' })
    expect(await partnerByPhone('0912000111')).toBeNull()
  })
})

describe('login', () => {
  test('đăng nhập sai mật khẩu', async () => {
    await asUser(null, () => registerPartner(fd(valid)))
    expect(await asUser(null, () => login(fd({ phone: '0912000111', password: 'x' }))))
      .toEqual({ error: 'invalid_credentials' })
  })

  test('SĐT không hợp lệ hoặc chưa đăng ký', async () => {
    expect(await asUser(null, () => login(fd({ phone: 'abc', password: '12345678' }))))
      .toEqual({ error: 'invalid_credentials' })
    expect(await asUser(null, () => login(fd({ phone: randomPhone(), password: '12345678' }))))
      .toEqual({ error: 'invalid_credentials' })
  })

  test('đối tác đăng nhập (SĐT dạng +84) → /doi-tac, phiên còn trong cookie', async () => {
    const p = await createPartner({ kind: 'commission' })
    await asUser(null, async () => {
      const intl = '+84' + p.phone.slice(1)
      expect(await redirectTarget(login(fd({ phone: intl, password: TEST_PASSWORD })))).toBe('/doi-tac')
      expect((await requirePartner()).partnerId).toBe(p.partnerId)
    })
  })

  test('staff và admin đăng nhập → /admin', async () => {
    for (const role of ['staff', 'admin'] as const) {
      const s = await createStaff(role)
      expect(await asUser(null, () => redirectTarget(login(fd({ phone: s.phone, password: TEST_PASSWORD })))))
        .toBe('/admin')
    }
  })

  test('đối tác bị khóa không đăng nhập được và không giữ phiên', async () => {
    const p = await createPartner({ kind: 'commission', status: 'locked' })
    await asUser(null, async () => {
      expect(await login(fd({ phone: p.phone, password: TEST_PASSWORD }))).toEqual({ error: 'locked' })
      expect((await createServerClient().auth.getUser()).data.user).toBeNull()
    })
  })

})

describe('/dang-xuat', () => {
  const logoutReq = (method: 'POST' | 'GET', cookie?: string) =>
    new NextRequest('http://localhost/dang-xuat', { method, headers: cookie ? { cookie } : {} })

  for (const [method, handler] of [['POST', logoutRoute], ['GET', logoutRouteGet]] as const) {
    test(`${method} xóa phiên rồi 303 về /dang-nhap`, async () => {
      const p = await createPartner({ kind: 'commission', status: 'pending' })
      await asUser(null, async () => {
        await redirectTarget(login(fd({ phone: p.phone, password: TEST_PASSWORD })))
        expect(await redirectTarget(requirePartner())).toBe('/cho-duyet')
        const res = await handler(logoutReq(method))
        expect(res.status).toBe(303)
        expect(new URL(res.headers.get('location')!).pathname).toBe('/dang-nhap')
        expect(await redirectTarget(requirePartner())).toBe('/dang-nhap')
      })
    })
  }

  test('signOut lỗi vẫn xóa cookie phiên sb-* trên phản hồi', async () => {
    const failing = { auth: { signOut: async () => ({ error: new Error('mạng lỗi') }) } }
    const res = await asUser({ client: failing as never }, () =>
      logoutRoute(logoutReq('POST', 'sb-abc-auth-token.0=x; sb-abc-auth-token.1=y; khac=z')))
    expect(res.status).toBe(303)
    const cleared = res.cookies.getAll().filter((c) => c.value === '' && c.maxAge === 0).map((c) => c.name)
    expect(cleared.sort()).toEqual(['sb-abc-auth-token.0', 'sb-abc-auth-token.1'])
  })
})

describe('requirePartner', () => {
  test('chưa đăng nhập → /dang-nhap', async () => {
    expect(await asUser(null, () => redirectTarget(requirePartner()))).toBe('/dang-nhap')
  })

  test('pending → /cho-duyet', async () => {
    const p = await createPartner({ kind: 'commission', status: 'pending' })
    expect(await asUser(p, () => redirectTarget(requirePartner()))).toBe('/cho-duyet')
  })

  test('locked → đăng xuất rồi /dang-nhap?locked=1', async () => {
    const p = await createPartner({ kind: 'commission', status: 'locked' })
    expect(await asUser(p, () => redirectTarget(requirePartner()))).toBe('/dang-nhap?locked=1')
    expect((await p.client.auth.getSession()).data.session).toBeNull()
  })

  test('staff (không phải đối tác) → /', async () => {
    const s = await createStaff('admin')
    expect(await asUser(s, () => redirectTarget(requirePartner()))).toBe('/')
  })

  test('active → PartnerSession theo bậc', async () => {
    for (const kind of ['commission', 'wholesale'] as const) {
      const p = await createPartner({ kind })
      expect(await asUser(p, () => requirePartner())).toEqual({
        userId: p.userId, partnerId: p.partnerId, kind, tierId: p.tierId,
        name: `Đối tác ${p.phone}`, deliveryAddress: 'Buôn Ma Thuột',
      })
    }
  })
})

describe('requireStaff', () => {
  test('chưa đăng nhập → /dang-nhap; đối tác → /', async () => {
    expect(await asUser(null, () => redirectTarget(requireStaff()))).toBe('/dang-nhap')
    const p = await createPartner({ kind: 'commission' })
    expect(await asUser(p, () => redirectTarget(requireStaff()))).toBe('/')
  })

  test('staff qua mức staff nhưng không qua mức admin', async () => {
    const s = await createStaff('staff')
    expect(await asUser(s, () => requireStaff())).toEqual({ userId: s.userId, role: 'staff' })
    expect(await asUser(s, () => redirectTarget(requireStaff('admin')))).toBe('/')
  })

  test('admin qua cả hai mức', async () => {
    const a = await createStaff('admin')
    expect(await asUser(a, () => requireStaff('admin'))).toEqual({ userId: a.userId, role: 'admin' })
    expect(await asUser(a, () => requireStaff())).toEqual({ userId: a.userId, role: 'admin' })
  })
})

describe('scripts/create-staff.ts', () => {
  const run = promisify(execFile)
  const createStaffCli = (...args: string[]) =>
    run('npx', ['tsx', 'scripts/create-staff.ts', ...args], { env: process.env })

  test('tạo staff đăng nhập được bằng SĐT; chạy lại cập nhật mật khẩu và vai trò', async () => {
    const phone = randomPhone()
    await createStaffCli('+84' + phone.slice(1), 'mat-khau-1', 'staff')
    await createStaffCli(phone, 'mat-khau-2', 'admin')

    const { data: users } = await adminClient().from('staff').select('user_id, role').throwOnError()
    expect(users).toHaveLength(1)
    expect(users[0].role).toBe('admin')
    const client = anonClient()
    const { error } = await client.auth.signInWithPassword({ email: `${phone}@partner.local`, password: 'mat-khau-2' })
    expect(error).toBeNull()
    expect(await asUser(null, () => redirectTarget(login(fd({ phone, password: 'mat-khau-2' }))))).toBe('/admin')
  })

  test('tham số sai → thoát mã khác 0', async () => {
    await expect(createStaffCli('0912345678', '12345678', 'boss')).rejects.toMatchObject({ code: 1 })
  })
})
