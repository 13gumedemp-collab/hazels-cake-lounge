/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Never reuse client-side cached server data for dynamic pages, so the
  // dashboard always reflects the live database when navigating.
  experimental: {
    staleTimes: { dynamic: 0, static: 0 },
  },
};
export default nextConfig;
