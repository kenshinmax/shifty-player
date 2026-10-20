import { PlatformHome } from "@/components/platform-home";
import { listLiveOrganizations } from "@/lib/db/platform-repository";

// Reads the database, so never prerender at build time.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const organizations = await listLiveOrganizations();
  return (
    <PlatformHome
      organizations={organizations.map(({ id, slug, name }) => ({
        id,
        slug,
        name,
      }))}
    />
  );
}
