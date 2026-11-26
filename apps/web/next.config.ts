import type { NextConfig } from "next";

// Allow `next/image` to optimize remote previews coming from Backblaze B2.
// Presigned download URLs use the bucket-specific S3 hostname pattern:
//   <bucket>.s3.<region>.backblazeb2.com    (path-style and virtual-host)
//   s3.<region>.backblazeb2.com             (path-style)
// One wildcard covers every region + bucket, so this config drops in
// without per-deployment tweaks.
const nextConfig: NextConfig = {
  transpilePackages: ["@vibe-coding-starter-kit/shared"],
  // Playwright drives the dev server at http://127.0.0.1:<port> (see
  // playwright.config.ts: `localhost` can resolve to ::1 first on macOS). Next
  // blocks dev resources requested from any host other than `localhost` unless
  // it is listed here, and then the page never hydrates. Dev-server only; it
  // has no effect on `next build` / production.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.backblazeb2.com",
      },
    ],
  },
};

export default nextConfig;
