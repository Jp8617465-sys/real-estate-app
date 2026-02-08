/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@realflow/shared', '@realflow/business-logic', '@realflow/ui'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
