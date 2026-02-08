/**
 * Minimal Next.js config for Vercel framework detection in monorepo.
 * The actual Next.js app is in apps/web/
 * This file helps Vercel detect that this is a Next.js project.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This config is only for detection purposes
  // The real config is in apps/web/next.config.js
  reactStrictMode: true,
}

module.exports = nextConfig
