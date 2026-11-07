// Ảnh sản phẩm; chưa có ảnh thì hiện khung xám trung tính.
export function ProductImage({ url, name, className = '' }: { url: string | null; name: string; className?: string }) {
  if (!url) {
    return (
      <div
        role="img"
        aria-label={`Chưa có ảnh ${name}`}
        className={`flex items-center justify-center bg-gray-100 text-sm text-gray-500 ${className}`}
      >
        Chưa có ảnh
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={name} loading="lazy" className={`object-cover ${className}`} />
}
