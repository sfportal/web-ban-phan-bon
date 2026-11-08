// supabase/deploy-payouts-production.sql trên DB mô phỏng bản thật (đã chạy 0001–0005, có hoa hồng
// đã chi theo cách cũ): trong MỘT giao dịch gỡ phần 0006–0008 rồi chạy file deploy, kiểm tra,
// cuối cùng rollback (DB test giữ nguyên).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { adminClient, createPartner, insertOrderFor, resetData } from './helpers'

const SQL = readFileSync(path.resolve(import.meta.dirname, '../../supabase/deploy-payouts-production.sql'), 'utf8')
// Bỏ begin;/commit; ngoài cùng để chạy bên trong giao dịch của test.
const BODY = SQL.replace(/^begin;\n/, '').replace(/\ncommit;\n$/, '\n')
const db = new pg.Client('postgres://postgres:postgres@127.0.0.1:54322/postgres')

beforeAll(async () => {
  await resetData()
  await db.connect()
})
afterAll(async () => {
  await db.end()
  await resetData()
})

/** Gỡ mọi thứ 0006–0008 thêm vào → trạng thái như bản thật sau 0005 (0007 chỉ thay hàm có sẵn). */
const TO_0005 = `
  drop function public.partner_wallet(uuid), public.request_payout(uuid, bigint, bigint),
    public.decide_payout(uuid, text, uuid, text), public.mark_payout_paid(uuid, uuid, text, date, text),
    public.create_payout_batch(text, date, bigint, uuid, text, boolean), public.delete_demo_data();
  drop table public.payouts, public.payout_batches;
  alter table public.partners drop column bank_name, drop column bank_account, drop column bank_holder, drop column is_demo;
  alter table public.farmers drop column is_demo;
  alter table public.orders drop column is_demo;
  delete from public.settings where key = 'min_payout';
  -- Local không có Storage: bảng giả để câu lệnh bucket chạy được.
  create schema if not exists storage;
  create table if not exists storage.buckets (
    id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
  );
`

test('chạy được trên bản thật sau 0005: hoa hồng đã chi cũ không rút lại; chạy lần hai bị chặn', async () => {
  expect(SQL.startsWith('begin;\n')).toBe(true)
  expect(SQL.endsWith('\ncommit;\n')).toBe(true)
  const p = await createPartner({ kind: 'commission' })
  for (const [amount, paid] of [[500000, true], [300000, false]] as const) {
    await adminClient().from('commission_entries').insert({
      partner_id: p.partnerId, order_id: await insertOrderFor(p.partnerId), kind: 'earn', amount, period: '2026-10',
      status: paid ? 'paid' : 'pending', paid_at: paid ? '2026-10-15T03:00:00Z' : null,
    }).throwOnError()
  }

  await db.query('begin')
  try {
    await db.query(TO_0005)
    expect((await db.query(`select to_regclass('public.payouts') as t`)).rows[0].t).toBeNull()

    await db.query(BODY)

    const w = (await db.query('select * from public.partner_wallet($1)', [p.partnerId])).rows[0]
    expect(w).toEqual({ earned: '800000', pending_out: '0', paid: '500000', available: '300000' })
    expect((await db.query(`select source, transfer_ref from public.payouts`)).rows)
      .toEqual([{ source: 'legacy', transfer_ref: 'LEGACY-TRUOC-VI' }])
    expect((await db.query(`select * from storage.buckets where id = 'payout-proofs'`)).rows[0]).toMatchObject({
      public: false, file_size_limit: '5242880', allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    })
    expect((await db.query(`select value from public.settings where key = 'min_payout'`)).rows[0]).toEqual({ value: 100000 })

    await db.query('savepoint again')
    await expect(db.query(BODY)).rejects.toThrow(/đã chạy rồi/)
    await db.query('rollback to savepoint again')
  } finally {
    await db.query('rollback')
  }
  expect((await adminClient().from('payouts').select('id').throwOnError()).data).toEqual([])
})
