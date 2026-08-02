import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@landed/shared-types'],
};

export default nextConfig;
