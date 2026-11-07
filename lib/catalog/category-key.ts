import type { CatalogCategory } from './queries'

/** Khóa lọc nhóm trên URL (?nhom=): slug; nhóm admin tự tạo chưa có slug thì dùng id. */
export const categoryKey = (c: Pick<CatalogCategory, 'id' | 'slug'>) => c.slug ?? c.id
