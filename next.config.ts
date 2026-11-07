import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Ảnh sản phẩm tải lên tối đa 2MB (mặc định Server Action chỉ nhận 1MB).
  // Route ảnh bảng giá đọc font .woff bằng fs theo process.cwd(); khai báo để bản build
  // standalone / serverless (Vercel) mang theo các file này.
  outputFileTracingIncludes: {
    '/bang-gia/anh': ['./node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-{latin,latin-ext,vietnamese}-{400,700}-normal.woff'],
  },
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
