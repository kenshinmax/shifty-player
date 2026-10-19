import type { MongoClient } from "mongodb";
import { createMongoStore } from "@/lib/db/doc-store";
import { dedupeProcessedPayments, migrateToOrganizations } from "@/lib/db/migrate-to-orgs";
import { getDb, getMongoClient, getMongoDbName } from "@/lib/mongo";

/** Host(s) from a mongodb:// or mongodb+srv:// URI, without credentials. */
function mongoHost(uri: string): string {
  const afterScheme = uri.replace(/^[a-z+]+:\/\//i, "");
  const authority = afterScheme.split(/[/?]/)[0];
  return authority.slice(authority.lastIndexOf("@") + 1);
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("MONGODB_URI is not set. Aborting migration.");
    process.exit(1);
  }
  console.log(`Migrating database "${getMongoDbName()}" on ${mongoHost(uri)}`);

  let client: MongoClient | undefined;
  try {
    client = await getMongoClient();
    // Must run before the store is created: the store builds unique indexes.
    const removed = await dedupeProcessedPayments(await getDb());
    console.log(`Removed ${removed} duplicate processed_payments document(s).`);
    const report = await migrateToOrganizations(createMongoStore(getDb));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client?.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
