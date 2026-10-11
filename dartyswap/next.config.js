/** @type {import('next').NextConfig} */
const noIndex = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: '/resultat', headers: noIndex },
      { source: '/resultat/:path*', headers: noIndex },
      { source: '/admin', headers: noIndex },
      { source: '/admin/:path*', headers: noIndex },
      { source: '/espace', headers: noIndex },
      { source: '/espace/:path*', headers: noIndex },
      { source: '/api/:path*', headers: noIndex },
    ];
  },
};

module.exports = nextConfig;
