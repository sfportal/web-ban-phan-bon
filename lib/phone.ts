// SĐT Việt Nam dạng nội địa: 0 + chữ số khác 0 + 8–9 số (khớp check của DB, migration 0004).
const LOCAL = /^0[1-9]\d{8,9}$/

export function normalizePhone(input: string): string | null {
  let s = input.replace(/[\s.\-()]/g, '')
  const m = /^(?:\+84|84)(\d+)$/.exec(s)
  if (m) {
    // "+84 0912…" / "+84 (0) 912…": bỏ đúng một số 0 sau mã nước.
    const rest = m[1].startsWith('0') ? m[1].slice(1) : m[1]
    if (LOCAL.test('0' + rest)) s = '0' + rest
  }
  return LOCAL.test(s) ? s : null
}

export function phoneToEmail(phone: string): string {
  const p = normalizePhone(phone)
  if (!p) throw new Error('invalid_phone')
  return `${p}@partner.local`
}
