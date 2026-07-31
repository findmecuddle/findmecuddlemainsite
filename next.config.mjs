/** @type {import('next').NextConfig} */
const nextConfig = {
  // next/image isn't used anywhere in this app (all photos render as plain <img> tags, see the
  // eslint-disable comments next to each one), so there's no legitimate need for the built-in
  // /_next/image optimization endpoint to fetch external URLs at all. The previous wildcard
  // hostname ("**") let that endpoint proxy-fetch literally any HTTPS URL on request — a real
  // SSRF-style abuse vector with zero upside. Leaving remotePatterns empty closes it off.
  images: { remotePatterns: [] },
};
export default nextConfig;
