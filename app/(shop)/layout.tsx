import { ShopFrame } from '@/components/shop/ShopFrame'

export default function ShopLayout({ children }: LayoutProps<'/'>) {
  return <ShopFrame>{children}</ShopFrame>
}
