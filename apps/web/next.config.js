/** @type {import('next').NextConfig} */

// ─── Product Mode ───────────────────────────────────────────────────────────
const PRODUCT_MODE = process.env.NEXT_PUBLIC_PRODUCT_MODE || 'both';
if (!['buyers_agent', 'selling_agent', 'both'].includes(PRODUCT_MODE)) {
  throw new Error(`Invalid NEXT_PUBLIC_PRODUCT_MODE: ${PRODUCT_MODE}`);
}

const nextConfig = {
  transpilePackages: ['@realflow/shared', '@realflow/business-logic', '@realflow/ui'],

  env: {
    NEXT_PUBLIC_PRODUCT_MODE: PRODUCT_MODE,
  },

  // ─── Image Optimization ──────────────────────────────────────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.domain.com.au',
      },
    ],
  },

  // ─── Compiler Optimizations ──────────────────────────────────────────────────
  compiler: {
    // Remove console.log in production (keep console.warn and console.error)
    ...(process.env.NODE_ENV === 'production' && {
      removeConsole: {
        exclude: ['error', 'warn'],
      },
    }),
  },

  // ─── Experimental Features ────────────────────────────────────────────────────
  experimental: {
    // Enable optimised package imports for common libraries
    optimizePackageImports: ['lucide-react', 'recharts', 'zod'],
  },

  // ─── Static Asset Headers ────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Immutable static assets (JS, CSS bundles with content hash)
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Optimised images
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // Static files in /public
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // Font files
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Security headers for all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },

  // ─── API Rewrites ────────────────────────────────────────────────────────────
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:3001'}/api/v1/:path*`,
      },
    ];
  },

  // ─── Redirects ───────────────────────────────────────────────────────────────
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/dashboard',
        permanent: true,
      },
      // Product mode build-time route exclusion
      ...(PRODUCT_MODE === 'buyers_agent'
        ? [
            { source: '/properties/:path*', destination: '/dashboard', permanent: false },
            { source: '/social/:path*', destination: '/dashboard', permanent: false },
            { source: '/market/:path*', destination: '/dashboard', permanent: false },
          ]
        : []),
      ...(PRODUCT_MODE === 'selling_agent'
        ? [
            { source: '/buyers-agent/:path*', destination: '/dashboard', permanent: false },
          ]
        : []),
    ];
  },

  // ─── Turbopack (default bundler in Next.js 15+) ─────────────────────────────
  // Explicit empty config silences the build error when a webpack config exists.
  turbopack: {},

  // ─── Webpack Customisation (used when Turbopack is disabled or for ANALYZE) ─
  webpack(config, { isServer }) {
    // Bundle analyzer (opt-in via ANALYZE=true)
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer ? '../analyze/server.html' : './analyze/client.html',
          openAnalyzer: false,
        }),
      );
    }

    return config;
  },
};

module.exports = nextConfig;
