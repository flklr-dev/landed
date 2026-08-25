import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, '../../'),
  },
  // Tailscale / LAN access to dev server (HMR, _next assets)
  allowedDevOrigins: ['100.117.225.87'],
  transpilePackages: ['@landed/shared-types'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;