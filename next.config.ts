import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  images: { formats: ['image/avif', 'image/webp'] },
  // Never allow a previously installed PWA worker to serve an old Turbopack
  // client chunk while developing. Production keeps its offline cache intact.
  async headers() {
    if (process.env.NODE_ENV === 'production') return [];
    return [{
      source: '/:path*',
      headers: [{ key: 'Clear-Site-Data', value: '"cache", "storage"' }],
    }];
  },
};
export default nextConfig;
