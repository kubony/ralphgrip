import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 클라이언트 Router Cache: 같은 동적 페이지 재방문 시 30초간 캐시 적중
    staleTimes: {
      dynamic: 30,
    },
    // 번들 최적화: barrel file import 자동 트리쉐이킹
    optimizePackageImports: [
      'recharts',
      'date-fns',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@uiw/react-md-editor',
    ],
  },
};

export default nextConfig;
