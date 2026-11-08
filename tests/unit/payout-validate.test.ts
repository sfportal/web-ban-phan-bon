import { describe, expect, test } from 'vitest'
import {
  MAX_PROOF_BYTES, PAYOUT_ERROR_MESSAGES, PAYOUT_STATUS_LABEL, parseAmount, parseBankInfo, proofExtension, validateProof,
} from '@/lib/payouts/validate'

describe('validateProof', () => {
  test('chấp nhận jpg/png/webp/pdf ≤ 5MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
      expect(validateProof({ type, size: 1000 })).toBe('ok')
    }
    expect(MAX_PROOF_BYTES).toBe(5 * 1024 * 1024)
    expect(validateProof({ type: 'application/pdf', size: 5 * 1024 * 1024 })).toBe('ok')
  })

  test('quá 5MB → too_large; sai loại hoặc rỗng → bad_type', () => {
    expect(validateProof({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toBe('too_large')
    expect(validateProof({ type: 'image/gif', size: 10 })).toBe('bad_type')
    expect(validateProof({ type: 'text/html', size: 10 })).toBe('bad_type')
    expect(validateProof({ type: '', size: 10 })).toBe('bad_type')
    expect(validateProof({ type: 'image/png', size: 0 })).toBe('bad_type')
  })

  test('đuôi file theo loại', () => {
    expect(proofExtension('image/jpeg')).toBe('jpg')
    expect(proofExtension('image/png')).toBe('png')
    expect(proofExtension('image/webp')).toBe('webp')
    expect(proofExtension('application/pdf')).toBe('pdf')
  })
})

describe('parseAmount', () => {
  test('nhận số trơn và có dấu phân cách nghìn', () => {
    expect(parseAmount('1500000')).toBe(1500000)
    expect(parseAmount('1.500.000')).toBe(1500000)
    expect(parseAmount('1,500,000')).toBe(1500000)
    expect(parseAmount(' 100.000 ')).toBe(100000)
    expect(parseAmount('1 500 000')).toBe(1500000)
    expect(parseAmount('100.000đ')).toBe(100000)
    expect(parseAmount('100000 ₫')).toBe(100000)
    expect(parseAmount('999')).toBe(999)
  })

  test('từ chối số lẻ, âm, 0, chữ, nhóm sai, trộn dấu', () => {
    for (const s of ['', '   ', 'abc', '0', '000', '-100000', '1.5', '1,5', '1.50.000', '1.500,000', '12a', '1e6', '.500', '1.000.']) {
      expect(parseAmount(s), s).toBeNull()
    }
    expect(parseAmount('9'.repeat(20))).toBeNull()
  })
})

describe('parseBankInfo', () => {
  const ok = { bank_name: ' Vietcombank ', bank_account: '0123 4567 89', bank_holder: ' NGUYEN VAN A ' }

  test('chuẩn hóa: bỏ khoảng trắng thừa, số tài khoản chỉ còn chữ số', () => {
    expect(parseBankInfo(ok)).toEqual({
      ok: true, value: { bank_name: 'Vietcombank', bank_account: '0123456789', bank_holder: 'NGUYEN VAN A' },
    })
  })

  test('thiếu ô → missing_fields; số TK sai → invalid_account', () => {
    expect(parseBankInfo({ ...ok, bank_name: '  ' })).toEqual({ error: 'missing_fields' })
    expect(parseBankInfo({ ...ok, bank_holder: '' })).toEqual({ error: 'missing_fields' })
    expect(parseBankInfo({ ...ok, bank_account: '' })).toEqual({ error: 'missing_fields' })
    for (const a of ['12345', '1'.repeat(21), '0123-456789', 'ABC123456', '01234567x']) {
      expect(parseBankInfo({ ...ok, bank_account: a }), a).toEqual({ error: 'invalid_account' })
    }
    expect(parseBankInfo({ ...ok, bank_account: '123456' })).toMatchObject({ ok: true })
    expect(parseBankInfo({ ...ok, bank_account: '1'.repeat(20) })).toMatchObject({ ok: true })
  })

  test('tên ngân hàng / chủ tài khoản quá 120 ký tự → missing_fields (không hợp lệ)', () => {
    expect(parseBankInfo({ ...ok, bank_name: 'x'.repeat(121) })).toEqual({ error: 'missing_fields' })
    expect(parseBankInfo({ ...ok, bank_holder: 'x'.repeat(121) })).toEqual({ error: 'missing_fields' })
  })
})

describe('nhãn và thông báo', () => {
  test('trạng thái khoản chi tiếng Việt', () => {
    expect(PAYOUT_STATUS_LABEL).toEqual({ requested: 'Chờ duyệt', approved: 'Đã duyệt', paid: 'Đã chuyển', rejected: 'Từ chối' })
  })
  test('mọi mã lỗi có thông báo tiếng Việt', () => {
    expect(PAYOUT_ERROR_MESSAGES.insufficient_balance).toBe('Số dư không đủ')
    expect(PAYOUT_ERROR_MESSAGES.not_active).toMatch(/chưa được duyệt|bị khóa/)
    for (const v of Object.values(PAYOUT_ERROR_MESSAGES)) expect(v.length).toBeGreaterThan(0)
  })
})
