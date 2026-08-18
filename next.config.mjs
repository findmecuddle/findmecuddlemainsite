/** @type {import('next').NextConfig} */
const nextConfig = {
  // next/image isn't used anywhere in this app (all photos render as plain <img> tags, see the
  // eslint-disable comments next to each one), so there's no legitimate need for the built-in
  // /_next/image optimization endpoint to fetch external URLs at all. The previous wildcard
  // hostname ("**") let that endpoint proxy-fetch literally any HTTPS URL on request — a real
  // SSRF-style abuse vector with zero upside. Leaving remotePatterns empty closes it off.
  images: { remotePatterns: [] },
  // Next.js buffers the request body in memory when middleware runs (Clerk's clerkMiddleware()
  // runs on every request — see src/middleware.ts), capped at 10MB by default. Photo uploads go up
  // to MAX_PHOTO_MB (lib/config.ts, currently 48MB), so anything over the old 10MB default was
  // getting silently truncated mid-upload before it ever reached the route handler — the multipart
  // body would arrive corrupted and formData() would throw "Failed to parse body as FormData".
  // Match this to nginx's client_max_body_size (50M) so neither layer is the bottleneck.
  experimental: { middlewareClientMaxBodySize: "50mb" },
};
export default nextConfig;
