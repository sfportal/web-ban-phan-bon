export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Cửa hàng vật tư";

/** Chỉ nhận link http(s) để tránh `javascript:` hay scheme lạ trong setting. */
export function safeHttpUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null
}
