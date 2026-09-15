import { beforeEach, describe, expect, it } from "vitest";
import {
  enrollPaidInDb,
  getRegistrationState,
  resetMemoryRegistrationDb,
  seedRegistrationState,
} from "@/lib/db/registration-repository";
import { sampleData } from "@/lib/sample-data";

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

    const first = await enrollPaidInDb(player.id, programId, clinicId);
    expect("error" in first).toBe(false);
    if ("error" in first) return;

    const enrolled = first.state.players.find((entry) => entry.id === player.id)!;
    expect(enrolled.sessionIds).toContain(clinicId);
    expect(enrolled.programIds).toContain(programId);
    expect(enrolled.paymentLinkSentAt).toBeTruthy();

    const second = await enrollPaidInDb(player.id, programId, clinicId);
    expect("error" in second).toBe(false);

    const after = await getRegistrationState();
    expect(
      after.players.find((entry) => entry.id === player.id)?.sessionIds.filter(
        (id) => id === clinicId,
      ),
    ).toHaveLength(1);
  });
});
