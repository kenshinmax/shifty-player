import { createMongoStore } from "@/lib/db/doc-store";
import { migrateToOrganizations } from "@/lib/db/migrate-to-orgs";
import { getDb, getMongoClient } from "@/lib/mongo";

async function main(): Promise<void> {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("MONGODB_URI is not set. Aborting migration.");
    process.exit(1);
  }
  try {
    const report = await migrateToOrganizations(createMongoStore(getDb));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await (await getMongoClient()).close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
