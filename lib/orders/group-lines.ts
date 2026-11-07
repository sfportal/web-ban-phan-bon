/** Nhóm dòng hàng theo nông dân, giữ thứ tự xuất hiện. `title` null = dòng không gắn nông dân. */
export function groupByFarmer<L extends { farmer_id: string | null; farmers: { name: string; phone: string } | null }>(
  lines: L[],
): { key: string; title: string | null; lines: L[] }[] {
  const groups: { key: string; title: string | null; lines: L[] }[] = []
  for (const l of lines) {
    const key = l.farmer_id ?? ''
    let g = groups.find((x) => x.key === key)
    if (!g) groups.push((g = { key, title: l.farmers ? `${l.farmers.name} · ${l.farmers.phone}` : null, lines: [] }))
    g.lines.push(l)
  }
  return groups
}
