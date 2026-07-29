/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep build output separate from the OneDrive-managed legacy `.next`
  // folder, which can retain stale reparse points on Windows.
  distDir: ".next-build",
  // Never reuse client-side cached server data for dynamic pages, so the
  // dashboard always reflects the live database when navigating.
  experimental: {
    staleTimes: { dynamic: 0, static: 0 },
  },
};
export default nextConfig;
