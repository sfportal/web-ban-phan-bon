// Ảnh minh hoạ từ Unsplash/Pexels (giấy phép miễn phí). Nguồn chi tiết: docs/nguon-anh.md.
// Không dùng ảnh bao bì/logo của hãng.

export type ImageKey =
  | 'hero'
  | 'auth'
  | 'partner'
  | 'trust'
  | 'cat-npk'
  | 'cat-phan-don'
  | 'cat-huu-co'
  | 'cat-phan-bon-la'
  | 'cat-thuoc-bvtv'
  | 'cat-vat-tu'

export type ImageMeta = {
  url: string
  alt: string
  author: string
  sourceUrl: string
  license: 'Unsplash' | 'Pexels'
}

const unsplash = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`
const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`

export const IMAGES: Record<ImageKey, ImageMeta> = {
  hero: {
    url: unsplash('photo-1609412058473-c199497c3c5d'),
    alt: 'Ruộng bậc thang lúa chín vàng ở Mù Cang Chải lúc bình minh',
    author: 'Hoach Le Dinh',
    sourceUrl: 'https://unsplash.com/photos/rice-terraces-in-mu-cang-chai-PeRt3uMmjYM',
    license: 'Unsplash',
  },
  auth: {
    url: unsplash('photo-1762944081230-52e549806fd7'),
    alt: 'Nông dân đội nón lá đi trên ruộng lúa ngập nước',
    author: 'Yiquan Zhang',
    sourceUrl: 'https://unsplash.com/photos/farmer-in-conical-hat-walks-through-flooded-rice-field-cJfHT9XjOoU',
    license: 'Unsplash',
  },
  partner: {
    url: unsplash('photo-1761279253195-0a5485723c8b'),
    alt: 'Người nông dân đội nón lá trên cánh đồng lúa ở Quảng Nam',
    author: 'Pete Walls',
    sourceUrl: 'https://unsplash.com/photos/farmer-wearing-conical-hat-in-a-rice-field-4trSs-cdM6c',
    license: 'Unsplash',
  },
  trust: {
    url: unsplash('photo-1542601906990-b4d3fb778b09'),
    alt: 'Hai bàn tay nâng cây con trong nắm đất',
    author: 'Noah Buscher',
    sourceUrl: 'https://unsplash.com/photos/hands-holding-small-plant-seedling-in-soil-x8ZStukS2PM',
    license: 'Unsplash',
  },
  'cat-npk': {
    url: pexels(31673795),
    alt: 'Bàn tay nông dân cầm nắm phân bón dạng hạt',
    author: 'Kashif Shah',
    sourceUrl: 'https://www.pexels.com/photo/hands-holding-granular-fertilizer-outdoors-31673795/',
    license: 'Pexels',
  },
  'cat-phan-don': {
    url: pexels(15388810),
    alt: 'Nông dân rải phân bón trên ruộng lúa xanh',
    author: 'Amar .M',
    sourceUrl: 'https://www.pexels.com/photo/man-putting-fertilizer-on-the-rice-field-15388810/',
    license: 'Pexels',
  },
  'cat-huu-co': {
    url: unsplash('photo-1584747420644-5c767eebcbe6'),
    alt: 'Bàn tay nâng nắm đất tơi xốp giàu mùn',
    author: 'THLT LCX',
    sourceUrl: 'https://unsplash.com/photos/WshjU5cSNU8',
    license: 'Unsplash',
  },
  'cat-phan-bon-la': {
    url: unsplash('photo-1604595031526-1c468db04a1c'),
    alt: 'Giọt nước đọng trên lá cây xanh',
    author: 'Eugene Golovesov',
    sourceUrl: 'https://unsplash.com/photos/green-plant-with-water-droplets-QY09RnP19e4',
    license: 'Unsplash',
  },
  'cat-thuoc-bvtv': {
    url: unsplash('photo-1711900177627-1182b446bc8f'),
    alt: 'Nông dân đeo bình phun thuốc trên ruộng xanh',
    author: 'Dibakar Roy',
    sourceUrl: 'https://unsplash.com/photos/a-person-spraying-pesticide-on-a-green-field-vHdyEGfNfy0',
    license: 'Unsplash',
  },
  'cat-vat-tu': {
    url: unsplash('photo-1645727527942-f12e14a0c841'),
    alt: 'Hệ thống tưới phun mưa trên ruộng rau',
    author: 'Elibet Valencia Muñoz',
    sourceUrl: 'https://unsplash.com/photos/sprinklers-spraying-water-on-a-field-of-crops-ztHHjV0t0Qw',
    license: 'Unsplash',
  },
}
