import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("legacy redirects", () => {
  it("sends legacy single-org URLs to their new homes (temporary)", async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toEqual([
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
    ]);
  });
});
