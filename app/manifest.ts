import type { MetadataRoute } from 'next'
import { SITE_NAME } from '@/lib/site'

// PWA: đối tác "Thêm vào màn hình chính" để mở thẳng khu đối tác như một ứng dụng.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: `${SITE_NAME} — đặt hàng phân bón dành cho cộng tác viên và đối tác`,
    lang: 'vi',
    start_url: '/doi-tac',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#15803d',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
