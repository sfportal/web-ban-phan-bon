import type { Metadata } from "next";
import localFont from "next/font/local";
import { SITE_NAME } from "@/lib/site";
import "./globals.css";

// Be Vietnam Pro tự host từ @fontsource (không tải được từ Google Fonts).
// Mỗi subset là một file riêng; ba họ font được xếp chồng trong --font-sans
// để trình duyệt chọn glyph theo từng ký tự. (next/font yêu cầu đường dẫn literal.)
const beVietnamVi = localFont({
  src: [
    { path: "../node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-600-normal.woff2", weight: "600" },
    { path: "../node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-bvp-vi",
  display: "swap",
});

const beVietnamLatinExt = localFont({
  src: [
    { path: "../node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-ext-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-ext-600-normal.woff2", weight: "600" },
    { path: "../node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-ext-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-bvp-latin-ext",
  display: "swap",
});

const beVietnamLatin = localFont({
  src: [
    { path: "../node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-600-normal.woff2", weight: "600" },
    { path: "../node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-bvp-latin",
  display: "swap",
});

export const metadata: Metadata = {
  title: SITE_NAME,
  description: `${SITE_NAME} — đặt hàng phân bón dành cho cộng tác viên và đối tác`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${beVietnamLatin.variable} ${beVietnamLatinExt.variable} ${beVietnamVi.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
