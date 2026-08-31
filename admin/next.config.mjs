/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://qgzpoyyijafblzfiyhoc.supabase.co; connect-src 'self' https://qgzpoyyijafblzfiyhoc.supabase.co; font-src 'self' data:; media-src 'self'; manifest-src 'self'; upgrade-insecure-requests",
  },
];

const nextConfig = {
  reactStrictMode: true,
  // Never reuse client-side cached server data for dynamic pages, so the
  // dashboard always reflects the live database when navigating.
  experimental: {
    staleTimes: { dynamic: 0, static: 0 },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    ];
  },
};
export default nextConfig;
