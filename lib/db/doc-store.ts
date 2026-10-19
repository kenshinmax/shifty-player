import type { Collection, Db, Document } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongo";

export type CollectionName =
  | "organizations"
  | "programs"
  | "sessions"
  | "children"
  | "enrollments"
  | "orders"
  | "processed_payments"
  | "players"
  | "players_legacy";

export type FilterValue =
  | string
  | number
  | boolean
  | { $in: readonly (string | number)[] }
  | { $exists: boolean };
export type Filter = Record<string, FilterValue>;

export interface DocStore {
  find<T extends object>(c: CollectionName, filter?: Filter): Promise<T[]>;
  findOne<T extends object>(c: CollectionName, filter: Filter): Promise<T | null>;
  count(c: CollectionName, filter?: Filter): Promise<number>;
  /** false when the unique key already exists. */
  insertOne<T extends object>(c: CollectionName, doc: T): Promise<boolean>;
  /** Upsert by filter; throws on unique-key conflict with a non-matching doc. */
  replaceOne<T extends object>(c: CollectionName, filter: Filter, doc: T): Promise<void>;
  updateMany(c: CollectionName, filter: Filter, set: Record<string, unknown>): Promise<number>;
  deleteMany(c: CollectionName, filter?: Filter): Promise<number>;
}

export type MemorySeed = Partial<Record<CollectionName, object[]>>;

type Row = Record<string, unknown>;

function uniqueKey(c: CollectionName): string {
  return c === "processed_payments" ? "paymentIntentId" : "id";
}

function matches(doc: Row, filter: Filter): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = doc[key];
    if (typeof expected === "object") {
      if ("$in" in expected) return (expected.$in as readonly unknown[]).includes(actual);
      return (actual !== undefined) === expected.$exists;
    }
    return actual === expected;
  });
}

export function createMemoryStore(seed: MemorySeed = {}): DocStore {
  const data = new Map<CollectionName, Row[]>();
  for (const [name, docs] of Object.entries(seed)) {
    data.set(name as CollectionName, structuredClone(docs) as Row[]);
  }
  const rows = (c: CollectionName): Row[] => {
    let list = data.get(c);
    if (!list) {
      list = [];
      data.set(c, list);
    }
    return list;
  };

  return {
    async find<T extends object>(c: CollectionName, filter: Filter = {}) {
      return rows(c).filter((d) => matches(d, filter)).map((d) => structuredClone(d) as T);
    },
    async findOne<T extends object>(c: CollectionName, filter: Filter) {
      const hit = rows(c).find((d) => matches(d, filter));
      return hit ? (structuredClone(hit) as T) : null;
    },
    async count(c, filter = {}) {
      return rows(c).filter((d) => matches(d, filter)).length;
    },
    async insertOne(c, doc) {
      const key = uniqueKey(c);
      const row = doc as Row;
      if (rows(c).some((d) => d[key] === row[key])) return false;
      rows(c).push(structuredClone(row));
      return true;
    },
    async replaceOne(c, filter, doc) {
      const list = rows(c);
      const key = uniqueKey(c);
      const row = structuredClone(doc) as Row;
      const index = list.findIndex((d) => matches(d, filter));
      if (index >= 0) {
        list[index] = row;
        return;
      }
      if (list.some((d) => d[key] === row[key])) {
        throw new Error(`Duplicate ${key} in ${c}`);
      }
      list.push(row);
    },
    async updateMany(c, filter, set) {
      const hits = rows(c).filter((d) => matches(d, filter));
      for (const d of hits) Object.assign(d, structuredClone(set));
      return hits.length;
    },
    async deleteMany(c, filter = {}) {
      const list = rows(c);
      const kept = list.filter((d) => !matches(d, filter));
      const removed = list.length - kept.length;
      data.set(c, kept);
      return removed;
    },
  };
}

const ORG_SCOPED: CollectionName[] = ["programs", "sessions", "enrollments", "orders"];
const ALL_COLLECTIONS: CollectionName[] = [
  "organizations",
  "programs",
  "sessions",
  "children",
  "enrollments",
  "orders",
  "processed_payments",
  "players",
  "players_legacy",
];

/** Names the collection and index so a duplicate-key failure is actionable. */
async function createUniqueIndex(
  collection: Collection,
  name: CollectionName,
  keys: Record<string, 1>,
): Promise<void> {
  try {
    await collection.createIndex(keys, { unique: true });
  } catch (error) {
    const index = Object.keys(keys).join("+");
    throw new Error(
      `Failed to create unique index on ${name} (${index}): ${(error as Error).message}`,
      { cause: error },
    );
  }
}

export function createMongoStore(getDatabase: () => Promise<Db>): DocStore {
  let indexes: Promise<void> | undefined;

  async function db(): Promise<Db> {
    const database = await getDatabase();
    indexes ??= (async () => {
      for (const name of ALL_COLLECTIONS) {
        if (name === "players" || name === "players_legacy") continue;
        const collection = database.collection(name);
        await createUniqueIndex(collection, name, { [uniqueKey(name)]: 1 });
        if (ORG_SCOPED.includes(name)) {
          await createUniqueIndex(collection, name, { orgId: 1, id: 1 });
        }
      }
    })().catch((error) => {
      indexes = undefined;
      throw error;
    });
    await indexes;
    return database;
  }

  return {
    async find<T extends object>(c: CollectionName, filter: Filter = {}) {
      const database = await db();
      return (await database.collection(c).find(filter, { projection: { _id: 0 } }).toArray()) as unknown as T[];
    },
    async findOne<T extends object>(c: CollectionName, filter: Filter) {
      const database = await db();
      return (await database.collection(c).findOne(filter, { projection: { _id: 0 } })) as T | null;
    },
    async count(c, filter = {}) {
      return (await db()).collection(c).countDocuments(filter);
    },
    async insertOne(c, doc) {
      try {
        await (await db()).collection(c).insertOne({ ...(doc as Document) });
        return true;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) return false;
        throw error;
      }
    },
    async replaceOne(c, filter, doc) {
      await (await db()).collection(c).replaceOne(filter, doc as Document, { upsert: true });
    },
    async updateMany(c, filter, set) {
      const result = await (await db()).collection(c).updateMany(filter, { $set: set });
      return result.matchedCount;
    },
    async deleteMany(c, filter = {}) {
      const result = await (await db()).collection(c).deleteMany(filter);
      return result.deletedCount;
    },
  };
}

type DocStoreGlobal = typeof globalThis & {
  __shiftyMemoryDocStore?: DocStore;
  __shiftyMongoDocStore?: DocStore;
};

const globalForStore = globalThis as DocStoreGlobal;

export function getDocStore(): DocStore {
  if (isMongoConfigured()) {
    globalForStore.__shiftyMongoDocStore ??= createMongoStore(getDb);
    return globalForStore.__shiftyMongoDocStore;
  }
  globalForStore.__shiftyMemoryDocStore ??= createMemoryStore();
  return globalForStore.__shiftyMemoryDocStore;
}

export function resetMemoryStore(seed?: MemorySeed): void {
  globalForStore.__shiftyMemoryDocStore = createMemoryStore(seed);
}
