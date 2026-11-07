export function normalizePhone(input: string): string | null {
  let s = input.replace(/[\s.\-()]/g, '')
  const m = /^(?:\+84|84)(\d+)$/.exec(s)
  if (m) {
    const digits = s.startsWith('+') ? s.slice(1) : s
    if (digits.length >= 11 && digits.length <= 12) s = '0' + m[1]
  }
  return /^0\d{9,10}$/.test(s) ? s : null
}

export function phoneToEmail(phone: string): string {
  const p = normalizePhone(phone)
  if (!p) throw new Error('invalid_phone')
  return `${p}@partner.local`
}
