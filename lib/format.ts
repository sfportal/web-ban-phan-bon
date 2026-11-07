export function formatVnd(n: number): string {
  const rounded = Math.round(n)
  const abs = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${rounded < 0 ? '-' : ''}${abs} đ`
}
