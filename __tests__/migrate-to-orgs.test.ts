import { describe, expect, it } from "vitest";
import { createMemoryStore, type CollectionName, type DocStore } from "@/lib/db/doc-store";
import { assembleLegacyState } from "@/lib/db/legacy-state";
import { migrateToOrganizations } from "@/lib/db/migrate-to-orgs";
import { forOrg } from "@/lib/db/org-repository";
import { DEFAULT_ORG_ID } from "@/lib/organizations";
import { sampleData } from "@/lib/sample-data";
import { normalizeRegistrationState } from "@/lib/storage";
import type { AppState, Child, Player } from "@/lib/types";

const NOW = "2026-02-01T00:00:00.000Z";
const CLINIC = "clinic-summer-2026-w1";
const PAID_AT = "2026-03-01T10:00:00.000Z";

const merchPlayer: Player = {
  id: "player-merch",
  name: "Merch Kid",
  email: "merch@example.com",
  grade: "5",
  level: "beginner",
  programIds: ["program-summer-2026"],
  sessionIds: [CLINIC],
  merchandiseOrder: {
    clinicId: CLINIC,
    items: [{ skuId: "tee", name: "Tee", size: "M", quantity: 1, unitCents: 2500 }],
    tuitionCents: 15000,
    swagCents: 2500,
    totalCents: 17500,
    paidAt: PAID_AT,
  },
} as Player;

function legacySeed(): AppState {
  return { ...sampleData, players: [...sampleData.players, merchPlayer] };
}

function legacyStore(state = legacySeed()): DocStore {
  return createMemoryStore({
    programs: state.programs,
    sessions: state.sessions,
    players: state.players,
  });
}

async function counts(store: DocStore) {
  const names: CollectionName[] = [
    "organizations", "programs", "sessions", "children",
    "enrollments", "orders", "players", "players_legacy",
  ];
  return Object.fromEntries(
    await Promise.all(names.map(async (n) => [n, await store.count(n)] as const)),
  );
}

describe("migrateToOrganizations", () => {
  it("migrates legacy data", async () => {
    const store = legacyStore();
    const report = await migrateToOrganizations(store, NOW);

    expect(report).toMatchObject({
      organizationCreated: true,
      programsStamped: sampleData.programs.length,
      sessionsStamped: sampleData.sessions.length,
      children: 13,
      enrollments: 12,
      orders: 1,
      legacyPlayersArchived: 13,
    });
    expect(await store.count("children")).toBe(13);
    expect(await store.count("players")).toBe(0);
    expect(await store.count("players_legacy")).toBe(13);
    for (const c of ["programs", "sessions"] as const) {
      const docs = await store.find<{ orgId?: string }>(c);
      expect(docs.every((d) => d.orgId === DEFAULT_ORG_ID)).toBe(true);
    }
    const merch = await store.findOne<{ status: string }>("enrollments", {
      id: `enr-player-merch-${CLINIC}`,
    });
    expect(merch?.status).toBe("paid");
    expect(await store.count("orders")).toBe(1);
  });

  it("is idempotent", async () => {
    const store = legacyStore();
    await migrateToOrganizations(store, NOW);
    const before = await counts(store);
    const second = await migrateToOrganizations(store, NOW);

    expect(second).toEqual({
      organizationCreated: false,
      programsStamped: 0,
      sessionsStamped: 0,
      children: 0,
      enrollments: 0,
      orders: 0,
      legacyPlayersArchived: 0,
      legacyPlayersRemaining: 0,
    });
    expect(await counts(store)).toEqual(before);
  });

  it("resumes after a partial run", async () => {
    const state = legacySeed();
    const stamped = state.programs.map((p) => ({ ...p, orgId: DEFAULT_ORG_ID }));
    const store = createMemoryStore({
      programs: stamped,
      sessions: state.sessions,
      players: state.players,
      children: state.players.slice(0, 5).map((p) => ({
        id: p.id, name: p.name, email: p.email, grade: p.grade, level: p.level,
        ...(p.parentUserId ? { parentUserId: p.parentUserId } : { createdByOrgId: DEFAULT_ORG_ID }),
      })),
    });

    const report = await migrateToOrganizations(store, NOW);
    expect(report.programsStamped).toBe(0);
    expect(report.sessionsStamped).toBe(state.sessions.length);

    const children = await store.find<Child>("children");
    expect(children).toHaveLength(13);
    expect(new Set(children.map((c) => c.id)).size).toBe(13);
    expect(await store.count("enrollments")).toBe(12);
    expect(await store.count("players")).toBe(0);
  });

  it("does not archive when verification fails", async () => {
    const inner = legacyStore();
    let skipped = false;
    const store: DocStore = {
      ...inner,
      async replaceOne(c, filter, doc) {
        if (c === "children" && !skipped) {
          skipped = true;
          return;
        }
        return inner.replaceOne(c, filter, doc);
      },
    };

    await expect(migrateToOrganizations(store, NOW)).rejects.toThrow(
      "Migration verification failed",
    );
    expect(await inner.count("players")).toBe(13);
    expect(await inner.count("players_legacy")).toBe(0);
  });

  it("leaves players written during the run in place", async () => {
    const inner = legacyStore();
    let injected = false;
    const store: DocStore = {
      ...inner,
      async find<T extends object>(c: CollectionName, filter = {}) {
        const rows = await inner.find<T>(c, filter);
        if (c === "players" && !injected) {
          injected = true;
          await inner.insertOne("players", { ...merchPlayer, id: "player-late", sessionIds: [] });
        }
        return rows;
      },
    };

    const report = await migrateToOrganizations(store, NOW);
    expect(report.legacyPlayersRemaining).toBe(1);
    expect(report.legacyPlayersArchived).toBe(13);
    expect(await inner.find<Player>("players")).toHaveLength(1);
    expect(await inner.count("players_legacy")).toBe(13);
  });

  it("rejects duplicate legacy player ids before archiving", async () => {
    // memory store rejects duplicate ids on insert, so seed them directly
    const state = legacySeed();
    const seeded = createMemoryStore({
      programs: state.programs,
      sessions: state.sessions,
      players: [...state.players, { ...state.players[0] }],
    });

    await expect(migrateToOrganizations(seeded, NOW)).rejects.toThrow(
      "Migration verification failed: duplicate player ids: player-1",
    );
    expect(await seeded.count("players")).toBe(14);
    expect(await seeded.count("players_legacy")).toBe(0);
  });

  it("after migration the app reads the same state", async () => {
    const linkedOnly: Player = {
      ...merchPlayer,
      id: "player-link-only",
      programIds: [],
      sessionIds: [],
      merchandiseOrder: undefined,
      paymentLinkSentAt: "2026-01-15T00:00:00.000Z",
    };
    const seed = legacySeed();
    const state = { ...seed, players: [...seed.players, linkedOnly] };
    const store = legacyStore(state);
    await migrateToOrganizations(store, NOW);

    const docs = await forOrg(DEFAULT_ORG_ID, store).loadOrgDocuments();
    const children = await store.find<Child>("children");
    expect(assembleLegacyState({ ...docs, children })).toEqual(
      normalizeRegistrationState(state),
    );
  });
});
