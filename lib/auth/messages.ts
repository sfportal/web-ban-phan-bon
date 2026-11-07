// Thông báo tiếng Việt cho mã lỗi của registerPartner()/login().
export const AUTH_ERROR_MESSAGE = {
  invalid_phone: 'Số điện thoại không hợp lệ',
  phone_taken: 'Số điện thoại đã được đăng ký',
  weak_password: 'Mật khẩu cần ít nhất 8 ký tự',
  missing_fields: 'Vui lòng điền đầy đủ thông tin',
  invalid_credentials: 'Sai số điện thoại hoặc mật khẩu',
  locked: 'Tài khoản đã bị khóa, vui lòng liên hệ cửa hàng',
} as const

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGE
