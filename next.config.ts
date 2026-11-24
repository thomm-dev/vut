import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/api/card': ['./assets/**'],
    '/c/[slug]/opengraph-image': ['./assets/**'],
    '/c/[slug]/twitter-image': ['./assets/**'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.trackercdn.com' },
      { protocol: 'https', hostname: 'trackercdn.com' },
      { protocol: 'https', hostname: 'owcdn.net' },
    ],
  },
}

export default nextConfig
