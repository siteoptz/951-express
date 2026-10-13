import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The dispatch sheet PDF reads the logo from disk when a booking is completed; make sure the serverless bundle has it.
  outputFileTracingIncludes: { '/api/**/*': ['./public/images/logos/logo-email.png'] },
  partialPrefetching: true,
  // Booking links are private (the token is the key): keep them out of search results, in the header as well as the page.
  async headers() {
    return [
      { source: '/booking/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
