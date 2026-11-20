import { MongoClient, type Db } from "mongodb";

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}

/**
 * Production must not silently fall back to the in-memory store, which loses
 * every registration on restart. Set ALLOW_IN_MEMORY_STORE=true to run a
 * production build locally without MongoDB.
 */
export function assertPersistentStore(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (isMongoConfigured()) return;
  if (process.env.ALLOW_IN_MEMORY_STORE === "true") return;
  throw new Error(
    "MONGODB_URI is required in production (set ALLOW_IN_MEMORY_STORE=true to override).",
  );
}

export function getMongoDbName(): string {
  return process.env.MONGODB_DB?.trim() || "shifty";
}

type MongoGlobal = typeof globalThis & {
  __shiftyMongoClient?: MongoClient;
  __shiftyMongoPromise?: Promise<MongoClient>;
};

const globalForMongo = globalThis as MongoGlobal;

export async function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (globalForMongo.__shiftyMongoClient) {
    return globalForMongo.__shiftyMongoClient;
  }

  if (!globalForMongo.__shiftyMongoPromise) {
    const client = new MongoClient(uri);
    globalForMongo.__shiftyMongoPromise = client.connect().then((connected) => {
      globalForMongo.__shiftyMongoClient = connected;
      return connected;
    });
  }

  return globalForMongo.__shiftyMongoPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getMongoDbName());
}
