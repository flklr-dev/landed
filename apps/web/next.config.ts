import type { NextConfig } from 'next';

import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@landed/shared-types'],
};

export default nextConfig;
