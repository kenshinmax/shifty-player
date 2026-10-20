import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDocStore, resetMemoryStore } from "@/lib/db/doc-store";
import { enrollmentId, splitLegacyState } from "@/lib/db/legacy-state";
import {
  createPlayerInDb,
  deleteClinicInDb,
  deletePlayerInDb,
  enrollPaidInDb,
  getRegistrationState,
  getStateForViewer,
  LEGACY_DATA_ERROR,
  ORG_NOT_FOUND,
  markPaymentLinkSentInDb,
  removePlayerFromProgramInDb,
  resetMemoryRegistrationDb,
  seedRegistrationState,
  setProgramOpenInDb,
  updatePlayerInDb,
  updateProgramInDb,
} from "@/lib/db/registration-repository";
import { DEFAULT_ORG_ID, defaultOrganization } from "@/lib/organizations";
import { sampleData } from "@/lib/sample-data";
import type { Child, Enrollment, Order, OrgProgram, OrgSession, Player } from "@/lib/types";

describe("registration repository", () => {
  beforeEach(() => {
    resetMemoryRegistrationDb(sampleData);
  });

  it("seeds and returns app state", async () => {
    const state = await seedRegistrationState(sampleData);
    expect(state.programs.length).toBeGreaterThan(0);
    expect(state.sessions.length).toBeGreaterThan(0);
    expect(state.players.length).toBeGreaterThan(0);
  });

  it("enrolls a child after payment idempotently", async () => {
    const player = sampleData.players.find(
      (entry) => entry.id === "player-child-1",
    )!;
    const clinicId = "clinic-summer-2026-w1";
    const programId = "program-summer-2026";

    // Ensure player is not already on that clinic in seed for this assertion.
    resetMemoryRegistrationDb({
      ...sampleData,
      players: sampleData.players.map((entry) =>
        entry.id === player.id
          ? {
              ...entry,
              sessionIds: entry.sessionIds.filter((id) => id !== clinicId),
              programIds: entry.programIds.filter((id) => id !== programId),
              paymentLinkSentAt: undefined,
            }
          : entry,
      ),
    });

    const first = await enrollPaidInDb(DEFAULT_ORG_ID, player.id, programId, clinicId);
    expect("error" in first).toBe(false);
    if ("error" in first) return;

    const enrolled = first.state.players.find((entry) => entry.id === player.id)!;
    expect(enrolled.sessionIds).toContain(clinicId);
    expect(enrolled.programIds).toContain(programId);
    expect(enrolled.paymentLinkSentAt).toBeTruthy();

    const second = await enrollPaidInDb(DEFAULT_ORG_ID, player.id, programId, clinicId);
    expect("error" in second).toBe(false);

    const after = await getRegistrationState(DEFAULT_ORG_ID);
    expect(
      after.players.find((entry) => entry.id === player.id)?.sessionIds.filter(
        (id) => id === clinicId,
      ),
    ).toHaveLength(1);
  });

  describe("org documents", () => {
    const clinicId = "clinic-summer-2026-w1";
    const programId = "program-summer-2026";
    const childId = "player-child-1";

    afterEach(() => {
      vi.restoreAllMocks();
    });

    async function storedEnrollment(id: string): Promise<Enrollment | null> {
      return getDocStore().findOne<Enrollment>("enrollments", { id });
    }

    it("mutations write only touched records", async () => {
      const spy = vi.spyOn(getDocStore(), "replaceOne");
      const result = await setProgramOpenInDb(DEFAULT_ORG_ID, programId, false);
      expect("error" in result).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls.map(([collection]) => collection)).toEqual(["programs"]);
    });

    it("other organizations are untouched", async () => {
      const orgB = "org-b";
      const program: OrgProgram = {
        ...sampleData.programs[0],
        id: "program-org-b",
        orgId: orgB,
      };
      const session: OrgSession = {
        ...sampleData.sessions[0],
        id: "session-org-b",
        programId: program.id,
        orgId: orgB,
      };
      const enrollment: Enrollment = {
        id: enrollmentId("player-child-2", session.id),
        orgId: orgB,
        childId: "player-child-2",
        programId: program.id,
        sessionId: session.id,
        status: "paid",
        paidAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      };
      const order: Order = {
        id: "ord-org-b",
        orgId: orgB,
        childId: "player-child-2",
        sessionId: session.id,
        items: [],
        tuitionCents: 10000,
        swagCents: 0,
        totalCents: 10000,
        platformFeeCents: 0,
        paidAt: "2026-01-02T00:00:00.000Z",
      };
      const sample = splitLegacyState(sampleData, DEFAULT_ORG_ID);
      resetMemoryStore({
        organizations: [defaultOrganization()],
        programs: [...sample.programs, program],
        sessions: [...sample.sessions, session],
        children: sample.children,
        enrollments: [...sample.enrollments, enrollment],
        orders: [...sample.orders, order],
      });

      expect(
        "error" in
          (await createPlayerInDb(DEFAULT_ORG_ID, {
            name: "New Kid",
            email: "new@example.com",
            grade: "6",
            level: "beginner",
            sessionIds: ["session-2026-01"],
          })),
      ).toBe(false);
      const clinic = sampleData.sessions.find((s) => s.id === clinicId)!;
      expect("error" in (await deleteClinicInDb(DEFAULT_ORG_ID, clinic.id))).toBe(false);
      await removePlayerFromProgramInDb(DEFAULT_ORG_ID, "player-child-2", "program-holiday-2025");
      await seedRegistrationState(sampleData);

      const store = getDocStore();
      expect(await store.find("programs", { orgId: orgB })).toEqual([program]);
      expect(await store.find("sessions", { orgId: orgB })).toEqual([session]);
      expect(await store.find("enrollments", { orgId: orgB })).toEqual([enrollment]);
      expect(await store.find("orders", { orgId: orgB })).toEqual([order]);
    });

    it("refuses to run on unmigrated data", async () => {
      const legacyPlayer: Player = sampleData.players[0];
      resetMemoryStore({ players: [legacyPlayer] });
      await expect(getRegistrationState(DEFAULT_ORG_ID)).rejects.toThrow(LEGACY_DATA_ERROR);
    });

    it("refuses to run on unmigrated programs without players", async () => {
      resetMemoryStore({ programs: sampleData.programs });
      await expect(getRegistrationState(DEFAULT_ORG_ID)).rejects.toThrow(LEGACY_DATA_ERROR);
      await expect(setProgramOpenInDb(DEFAULT_ORG_ID, programId, false)).rejects.toThrow(LEGACY_DATA_ERROR);
      expect(await getDocStore().count("children")).toBe(0);
    });

    it("refuses to run on unmigrated sessions without players", async () => {
      resetMemoryStore({ sessions: sampleData.sessions });
      await expect(getRegistrationState(DEFAULT_ORG_ID)).rejects.toThrow(LEGACY_DATA_ERROR);
      await expect(setProgramOpenInDb(DEFAULT_ORG_ID, programId, false)).rejects.toThrow(LEGACY_DATA_ERROR);
      expect(await getDocStore().count("children")).toBe(0);
    });

    it("tuition-only paid enrollment stays paid", async () => {
      const result = await enrollPaidInDb(DEFAULT_ORG_ID, childId, programId, clinicId);
      expect("error" in result).toBe(false);
      const id = enrollmentId(childId, clinicId);
      expect((await storedEnrollment(id))?.status).toBe("paid");

      const program = sampleData.programs.find((p) => p.id === "program-winter-2026")!;
      const updated = await updateProgramInDb(DEFAULT_ORG_ID, program.id, {
        name: program.name,
        description: "Updated description",
        startDate: program.startDate!,
        endDate: program.endDate!,
        open: program.open,
        spots: program.spots!,
        location: program.location,
      });
      expect("error" in updated).toBe(false);
      expect((await storedEnrollment(id))?.status).toBe("paid");
    });

    it("re-registering after removal revives the enrollment", async () => {
      await enrollPaidInDb(DEFAULT_ORG_ID, childId, programId, clinicId);
      await removePlayerFromProgramInDb(DEFAULT_ORG_ID, childId, programId);
      const id = enrollmentId(childId, clinicId);
      expect((await storedEnrollment(id))?.status).toBe("removed");

      const again = await enrollPaidInDb(DEFAULT_ORG_ID, childId, programId, clinicId);
      expect("error" in again).toBe(false);
      const docs = await getDocStore().find<Enrollment>("enrollments", { id });
      expect(docs).toHaveLength(1);
      expect(docs[0].status).not.toBe("removed");
    });

    it("deleting a player keeps their orders", async () => {
      await enrollPaidInDb(DEFAULT_ORG_ID, childId, programId, clinicId, "2026-06-01T00:00:00.000Z", {
        clinicId,
        items: [
          { skuId: "tee", name: "Tee", size: "M", quantity: 1, unitCents: 2000 },
        ],
        tuitionCents: 10000,
        swagCents: 2000,
        totalCents: 12000,
        paidAt: "2026-06-01T00:00:00.000Z",
      });
      const store = getDocStore();
      const ordersBefore = await store.count("orders");
      expect(ordersBefore).toBeGreaterThan(0);

      expect("error" in (await deletePlayerInDb(DEFAULT_ORG_ID, childId))).toBe(false);
      expect(await store.count("orders")).toBe(ordersBefore);
      expect(await store.count("children", { id: childId })).toBe(1);
      const active = (await store.find<Enrollment>("enrollments", { childId })).filter(
        (e) => e.status !== "removed",
      );
      expect(active).toHaveLength(0);
    });

    it("payment link persists for a player with no registrations", async () => {
      // An org-created player stays on the roster without registrations.
      const rosterId = sampleData.players[0].id;
      resetMemoryRegistrationDb({
        ...sampleData,
        players: sampleData.players.map((p) =>
          p.id === rosterId ? { ...p, programIds: [], sessionIds: [] } : p,
        ),
      });
      const result = await markPaymentLinkSentInDb(DEFAULT_ORG_ID, rosterId);
      expect("error" in result).toBe(false);
      const after = await getRegistrationState(DEFAULT_ORG_ID);
      const player = after.players.find((p) => p.id === rosterId)!;
      expect(player.sessionIds).toEqual([]);
      expect(player.paymentLinkSentAt).toBeTruthy();
    });

    it("removing a player from their only program keeps the payment link", async () => {
      await enrollPaidInDb(DEFAULT_ORG_ID, childId, programId, clinicId);
      expect("error" in (await markPaymentLinkSentInDb(DEFAULT_ORG_ID, childId))).toBe(false);
      const sent = (await getRegistrationState(DEFAULT_ORG_ID)).players.find((p) => p.id === childId)!
        .paymentLinkSentAt;
      expect(sent).toBeTruthy();

      await removePlayerFromProgramInDb(DEFAULT_ORG_ID, childId, programId);
      const player = (await getRegistrationState(DEFAULT_ORG_ID)).players.find((p) => p.id === childId)!;
      expect(player.sessionIds).toEqual([]);
      expect(player.paymentLinkSentAt).toBe(sent);
    });
  });

  describe("viewer scoping", () => {
    const programId = "program-summer-2026";
    const clinicId = "clinic-summer-2026-w1";

    it("public viewer gets no players but correct seatCounts", async () => {
      const state = await getStateForViewer(DEFAULT_ORG_ID, { kind: "public" });
      expect(state.players).toEqual([]);
      expect(state.seatCounts?.["session-2026-01"]).toBe(10);
      expect(state.programs.length).toBeGreaterThan(0);
      expect(state.sessions.length).toBeGreaterThan(0);
    });

    it("parent viewer sees only their own children", async () => {
      const state = await getStateForViewer(DEFAULT_ORG_ID, {
        kind: "parent",
        userId: "user-1",
      });
      expect(state.players.map((p) => p.id).sort()).toEqual([
        "player-child-1",
        "player-child-2",
      ]);
      expect(state.seatCounts?.["session-2026-01"]).toBe(10);
    });

    it("admin viewer sees the org roster only", async () => {
      const foreign: Child = {
        id: "child-org-b",
        createdByOrgId: "org-b",
        name: "Other Org Kid",
        email: "other@example.com",
        grade: "5",
        level: "beginner",
      } as Child;
      await getDocStore().insertOne("children", foreign);
      const state = await getStateForViewer(DEFAULT_ORG_ID, { kind: "admin" });
      const ids = state.players.map((p) => p.id);
      expect(ids).not.toContain("child-org-b");
      // Not yet enrolled here, and created by a parent: not on the roster.
      expect(ids).not.toContain("player-child-1");
      expect(ids).toContain("player-child-2");
      expect(ids).toContain(sampleData.players[0].id);
    });

    it("first registration of a parent's child succeeds", async () => {
      const result = await enrollPaidInDb(
        DEFAULT_ORG_ID,
        "player-child-1",
        programId,
        clinicId,
      );
      expect("error" in result).toBe(false);
      const admin = await getStateForViewer(DEFAULT_ORG_ID, { kind: "admin" });
      expect(admin.players.find((p) => p.id === "player-child-1")?.sessionIds).toContain(
        clinicId,
      );
    });

    it("deleting a parent's child only removes this org's enrollments", async () => {
      const childId = "player-child-2";
      expect("error" in (await deletePlayerInDb(DEFAULT_ORG_ID, childId))).toBe(false);

      const store = getDocStore();
      expect(await store.findOne("children", { id: childId })).not.toBeNull();
      const active = (await store.find<Enrollment>("enrollments", { childId })).filter(
        (e) => e.status !== "removed",
      );
      expect(active).toHaveLength(0);

      const parent = await getStateForViewer(DEFAULT_ORG_ID, {
        kind: "parent",
        userId: "user-1",
      });
      expect(parent.players.map((p) => p.id)).toContain(childId);
      const admin = await getStateForViewer(DEFAULT_ORG_ID, { kind: "admin" });
      expect(admin.players.map((p) => p.id)).not.toContain(childId);
    });

    it("deleting an org-created player deletes the child", async () => {
      const playerId = sampleData.players[0].id;
      expect("error" in (await deletePlayerInDb(DEFAULT_ORG_ID, playerId))).toBe(false);
      expect(await getDocStore().findOne("children", { id: playerId })).toBeNull();
    });

    it("player writes to a child outside the roster report not found", async () => {
      const result = await markPaymentLinkSentInDb(DEFAULT_ORG_ID, "player-child-1");
      expect(result).toEqual({ error: "Player not found." });
      const updated = await updatePlayerInDb(DEFAULT_ORG_ID, "player-child-1", {
        name: "Taken",
        email: "taken@example.com",
        grade: "5",
        level: "beginner",
        sessionIds: ["session-2026-01"],
      });
      expect(updated).toEqual({ error: "Player not found." });
      expect(
        await getDocStore().count("enrollments", { childId: "player-child-1" }),
      ).toBe(0);
    });

    it("only the default org is auto-seeded", async () => {
      await getDocStore().insertOne("organizations", {
        ...defaultOrganization(),
        id: "org-b",
        slug: "org-b",
      });
      const state = await getStateForViewer("org-b", { kind: "admin" });
      expect(state.programs).toEqual([]);
      expect(state.sessions).toEqual([]);
      expect(state.players).toEqual([]);
      expect(state.seatCounts).toEqual({});
    });

    it("unknown org is rejected", async () => {
      await expect(
        getStateForViewer("org-missing", { kind: "public" }),
      ).rejects.toThrow(ORG_NOT_FOUND);
      expect(await getDocStore().count("programs", { orgId: "org-missing" })).toBe(0);
    });
  });
});
