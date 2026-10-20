import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Overridden by Playwright so the e2e server can run alongside `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Pre-multi-org URLs live on under the default organization.
  async redirects() {
    return [
      { source: "/programs", destination: "/o/shifty-player/programs", permanent: false },
      { source: "/clinics", destination: "/o/shifty-player/clinics", permanent: false },
      { source: "/showcases", destination: "/o/shifty-player/showcases", permanent: false },
      { source: "/dashboard", destination: "/o/shifty-player/admin", permanent: false },
      {
        source: "/dashboard/programs/:path*",
        destination: "/o/shifty-player/admin/programs/:path*",
        permanent: false,
      },
      { source: "/player", destination: "/account", permanent: false },
      {
        source: "/player/registration/:playerId/:clinicId",
        destination: "/o/shifty-player/register/:playerId/:clinicId",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
