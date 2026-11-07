import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Ảnh sản phẩm tải lên tối đa 2MB (mặc định Server Action chỉ nhận 1MB).
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
