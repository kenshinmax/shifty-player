import type { Db, ObjectId } from "mongodb";
import type { DocStore } from "@/lib/db/doc-store";
import { splitLegacyState, type OrgDocuments } from "@/lib/db/legacy-state";
import { diffOrgDocuments } from "@/lib/db/org-diff";
import { forOrg } from "@/lib/db/org-repository";
import { DEFAULT_ORG_ID, defaultOrganization } from "@/lib/organizations";
import { normalizeRegistrationState } from "@/lib/storage";
import type { Child, Enrollment, Player } from "@/lib/types";

export type MigrationReport = {
  organizationCreated: boolean;
  programsStamped: number;
  sessionsStamped: number;
  children: number;
  enrollments: number;
  orders: number;
  legacyPlayersArchived: number;
  /** Players written to `players` during the run; rerun to migrate them. */
  legacyPlayersRemaining: number;
};

/**
 * One-time, idempotent move from the legacy `players` collection to organization
 * documents. Operates directly on the store (the registration repository refuses
 * to run while `players` is non-empty).
 */
export async function migrateToOrganizations(
  store: DocStore,
  now: string = new Date().toISOString(),
): Promise<MigrationReport> {
  const organizationCreated = await store.insertOne(
    "organizations",
    defaultOrganization(now),
  );

  const unstamped = { orgId: { $exists: false } };
  const programsStamped = await store.updateMany("programs", unstamped, {
    orgId: DEFAULT_ORG_ID,
  });
  const sessionsStamped = await store.updateMany("sessions", unstamped, {
    orgId: DEFAULT_ORG_ID,
  });

  const repo = forOrg(DEFAULT_ORG_ID, store);
  const players = await store.find<Player>("players");
  assertUniquePlayerIds(players);
  const orgDocs = await repo.loadOrgDocuments();
  const existing: OrgDocuments = {
    ...orgDocs,
    children: await store.find<Child>("children"),
  };

  const legacy = normalizeRegistrationState({
    programs: orgDocs.programs.map(withoutOrg),
    sessions: orgDocs.sessions.map(withoutOrg),
    players,
  });
  const target = splitLegacyState(legacy, DEFAULT_ORG_ID, existing, now);

  // Upserts only: a rerun (no players left) must never remove migrated data.
  const ops = diffOrgDocuments(existing, target);
  const writes = {
    ...ops,
    programs: { ...ops.programs, remove: [] },
    sessions: { ...ops.sessions, remove: [] },
    children: { ...ops.children, remove: [] },
    enrollments: { ...ops.enrollments, remove: [] },
  };
  await repo.applyWrites(writes);

  await verify(store, legacy.players, legacy.sessions.map((s) => s.id));

  for (const player of players) {
    await store.replaceOne("players_legacy", { id: player.id }, player);
  }
  await store.deleteMany("players", { id: { $in: players.map((p) => p.id) } });
  const legacyPlayersRemaining = await store.count("players");

  return {
    organizationCreated,
    programsStamped,
    sessionsStamped,
    children: writes.children.upsert.length,
    enrollments: writes.enrollments.upsert.length,
    orders: writes.orders.upsert.length,
    legacyPlayersArchived: players.length,
    legacyPlayersRemaining,
  };
}

function assertUniquePlayerIds(players: Player[]): void {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const { id } of players) (seen.has(id) ? dupes : seen).add(id);
  if (dupes.size > 0) {
    throw new Error(
      `Migration verification failed: duplicate player ids: ${[...dupes].join(", ")}`,
    );
  }
}

function withoutOrg<T extends { orgId: string }>(doc: T): Omit<T, "orgId"> {
  const copy: Partial<T> = { ...doc };
  delete copy.orgId;
  return copy as Omit<T, "orgId">;
}

async function verify(
  store: DocStore,
  players: Player[],
  sessionIds: string[],
): Promise<void> {
  if (players.length === 0) return;
  const validSessions = new Set(sessionIds);
  const ids = players.map((p) => p.id);

  const children = await store.find<Child>("children", { id: { $in: ids } });
  const present = new Set(children.map((c) => c.id));
  const missing = ids.filter((id) => !present.has(id));
  if (missing.length > 0) {
    throw new Error(
      `Migration verification failed: children missing for players ${missing.join(", ")}`,
    );
  }

  const expected = players.reduce(
    (sum, p) => sum + p.sessionIds.filter((id) => validSessions.has(id)).length,
    0,
  );
  const enrollments = await store.find<Enrollment>("enrollments", {
    orgId: DEFAULT_ORG_ID,
    childId: { $in: ids },
  });
  const active = enrollments.filter((e) => e.status !== "removed").length;
  if (active !== expected) {
    throw new Error(
      `Migration verification failed: expected ${expected} active enrollments, found ${active}`,
    );
  }
}

/**
 * Mongo-only pre-step: before the unique paymentIntentId index existed, the
 * webhook and confirm-enrollment could both record the same payment. Keep the
 * earliest record per paymentIntentId and delete the rest, so the index can be
 * built. Returns the number of documents removed.
 */
export async function dedupeProcessedPayments(db: Db): Promise<number> {
  const groups = await db
    .collection("processed_payments")
    .aggregate<{ docs: { _id: ObjectId; processedAt?: string }[] }>([
      { $group: { _id: "$paymentIntentId", docs: { $push: { _id: "$_id", processedAt: "$processedAt" } } } },
      { $match: { "docs.1": { $exists: true } } },
    ])
    .toArray();
  const extra = groups.flatMap((group) =>
    [...group.docs]
      .sort((a, b) => (a.processedAt ?? "").localeCompare(b.processedAt ?? ""))
      .slice(1)
      .map((doc) => doc._id),
  );
  if (extra.length === 0) return 0;
  const result = await db.collection("processed_payments").deleteMany({ _id: { $in: extra } });
  return result.deletedCount;
}
