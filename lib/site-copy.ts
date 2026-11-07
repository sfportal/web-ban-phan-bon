// Chủ cửa hàng xem và sửa câu chữ tại đây.
// Toàn bộ câu chữ quảng bá hiển thị cho khách ở trang cửa hàng. Giữ lời lẽ trung tính,
// không hứa điều cửa hàng chưa xác nhận (nguồn gốc, kiểm hàng, miễn phí...).

export const HERO = {
  title: 'Vật tư nông nghiệp cho nhà nông — đặt nhanh, giao tận nơi',
  subtitle: 'Phân bón, thuốc BVTV và vật tư của các hãng quen thuộc. Giá niêm yết rõ ràng, đặt hàng vài phút.',
} as const

export const TRUST_ITEMS = [
  { icon: 'shield', title: 'Sản phẩm từ các thương hiệu quen thuộc', text: 'Phân bón, thuốc BVTV và vật tư nhiều hãng.' },
  { icon: 'truck', title: 'Giao hàng theo khu vực', text: 'Liên hệ cửa hàng để biết khu vực và thời gian giao.' },
  { icon: 'headset', title: 'Hỗ trợ tư vấn cách dùng', text: 'Hỏi cách bón, liều phun cho từng loại cây.' },
  { icon: 'coins', title: 'Hoa hồng cho cộng tác viên', text: 'Giới thiệu bà con mua hàng, nhận hoa hồng theo đơn.' },
] as const

export const PRODUCT_ASSURANCE = {
  delivery: 'Giao hàng theo khu vực, thanh toán khi nhận hoặc chuyển khoản',
  info: 'Thông tin sản phẩm tham khảo theo nhãn nhà sản xuất',
} as const

export const FOOTER = {
  about: 'Phân bón, thuốc BVTV và vật tư nông nghiệp cho bà con, đặt nhanh, giao theo khu vực.',
  note: 'Giá có thể thay đổi theo thời điểm; giá áp dụng là giá trên đơn khi bạn đặt.',
  credit: 'Ảnh minh họa từ Unsplash và Pexels.',
} as const

export const RETAIL_PHONE_HINT = 'Cửa hàng có thể gọi số này để xác nhận đơn.'
