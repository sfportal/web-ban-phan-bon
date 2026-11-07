// Bảng/hàm tạo sau 0002 (vd RPC ở 0003) không được tự động ghi/execute bởi anon/authenticated.
import pg from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'

const db = new pg.Client('postgres://postgres:postgres@127.0.0.1:54322/postgres')

beforeAll(async () => {
  await db.connect()
  await db.query(`
    create table public.zz_future_table (id bigint generated always as identity primary key, v text);
    create function public.zz_future_fn() returns int language sql as 'select 1';
  `)
})
afterAll(async () => {
  await db.query('drop table if exists public.zz_future_table; drop function if exists public.zz_future_fn()')
  await db.end()
})

async function asRole<T>(role: string, sql: string): Promise<{ rows?: T[]; code?: string }> {
  await db.query('begin')
  try {
    await db.query(`set local role ${role}`)
    return { rows: (await db.query(sql)).rows as T[] }
  } catch (e) {
    return { code: (e as { code?: string }).code }
  } finally {
    await db.query('rollback')
  }
}

for (const role of ['anon', 'authenticated']) {
  test(`${role}: hàm mới không execute được`, async () => {
    expect((await asRole(role, 'select public.zz_future_fn()')).code).toBe('42501')
  })
  test(`${role}: bảng mới chỉ đọc, không ghi được`, async () => {
    expect((await asRole(role, 'select * from public.zz_future_table')).rows).toEqual([])
    expect((await asRole(role, `insert into public.zz_future_table (v) values ('x')`)).code).toBe('42501')
    expect((await asRole(role, `update public.zz_future_table set v = 'y'`)).code).toBe('42501')
    expect((await asRole(role, 'delete from public.zz_future_table')).code).toBe('42501')
  })
}

test('service_role: hàm và bảng mới dùng được', async () => {
  const { rows } = await asRole<{ n: number }>('service_role', 'select public.zz_future_fn() as n')
  expect(rows).toEqual([{ n: 1 }])
  const ins = await asRole('service_role', `insert into public.zz_future_table (v) values ('x') returning v`)
  expect(ins.rows).toEqual([{ v: 'x' }])
})
