import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Overridden by Playwright so the e2e server can run alongside `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
