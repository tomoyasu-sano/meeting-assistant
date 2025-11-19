import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/Cloud Run
  output: 'standalone',

  // Disable static optimization for dynamic routes
  // This ensures proper server-side rendering in Cloud Run
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default withNextIntl(nextConfig);
