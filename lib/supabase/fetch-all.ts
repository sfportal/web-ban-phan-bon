const PAGE = 1000

/**
 * Đọc hết các trang của một truy vấn (PostgREST hosted trả tối đa 1000 dòng mỗi lần).
 * `page(from, to)` phải có `.order(...)` ổn định và `.range(from, to)`.
 */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data } = await page(from, from + PAGE - 1)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) return all
  }
}
