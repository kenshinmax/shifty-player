import { MongoClient, type Db } from "mongodb";

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
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
