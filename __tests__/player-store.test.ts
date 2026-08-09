import { describe, expect, it } from "vitest";
import { sampleData } from "@/lib/sample-data";
import {
  addPlayer,
  addSession,
  deletePlayer,
  deleteSession,
  filterSessionsByYearMonth,
  getVisiblePlayers,
  updatePlayer,
  updateSession,
  validatePlayerInput,
} from "@/lib/player-store";

describe("sampleData", () => {
  it("loads seven sessions and ten players on the January 2026 session", () => {
    expect(sampleData.sessions).toHaveLength(7);
    expect(sampleData.players).toHaveLength(10);
    expect(sampleData.sessions[0]).toMatchObject({ year: 2026, month: 1 });
  });
});

describe("player-store", () => {
  it("filters sessions by year and month", () => {
    const state = {
      sessions: [
        { id: "s1", year: 2026, month: 1, status: "trending" as const },
        { id: "s2", year: 2026, month: 2, status: "in-progress" as const },
        { id: "s3", year: 2025, month: 12, status: "completed" as const },
      ],
      players: [],
    };

    expect(filterSessionsByYearMonth(state.sessions, 2026, 1)).toHaveLength(1);
    expect(filterSessionsByYearMonth(state.sessions, 2026, null)).toHaveLength(2);
  });

  it("adds, updates, and deletes players", () => {
    let state = sampleData;

    state = addPlayer(state, {
      name: "New Player",
      email: "new.player@example.com",
      grade: "4",
      level: "beginner",
      sessionIds: [sampleData.sessions[0].id],
    });
    expect(state.players).toHaveLength(11);

    const newPlayer = state.players.at(-1)!;
    state = updatePlayer(state, newPlayer.id, {
      ...newPlayer,
      grade: "5",
    });
    expect(state.players.at(-1)?.grade).toBe("5");

    state = deletePlayer(state, newPlayer.id);
    expect(state.players).toHaveLength(10);
  });

  it("adds, updates, and deletes sessions with player cleanup", () => {
    let state = sampleData;
    const sessionId = sampleData.sessions[0].id;

    const duplicate = addSession(state, {
      year: 2026,
      month: 1,
      status: "trending",
    });
    expect("error" in duplicate).toBe(true);

    const added = addSession(state, {
      year: 2026,
      month: 2,
      label: "Spring",
      status: "in-progress",
    });
    expect("error" in added).toBe(false);
    if ("error" in added) return;

    state = added;
    const newSession = state.sessions.find((session) => session.month === 2)!;

    const updated = updateSession(state, newSession.id, {
      year: 2026,
      month: 2,
      label: "Early Spring",
      status: "in-progress",
    });
    expect("error" in updated).toBe(false);
    if ("error" in updated) return;

    state = updated;
    state = {
      ...state,
      players: state.players.map((player, index) =>
        index === 0
          ? { ...player, sessionIds: [...player.sessionIds, newSession.id] }
          : player,
      ),
    };

    state = deleteSession(state, newSession.id);
    expect(state.sessions.some((session) => session.id === newSession.id)).toBe(
      false,
    );
    expect(state.players[0].sessionIds).toEqual([sessionId]);
  });

  it("returns visible players for selected sessions", () => {
    const visible = getVisiblePlayers(sampleData.players, [
      sampleData.sessions[0].id,
    ]);
    expect(visible).toHaveLength(10);
    expect(getVisiblePlayers(sampleData.players, [])).toHaveLength(0);
  });

  it("validates player input", () => {
    expect(
      validatePlayerInput({
        name: "",
        email: "alex@example.com",
        grade: "4",
        level: "beginner",
        sessionIds: ["s1"],
      }),
    ).toBe("Name is required.");

    expect(
      validatePlayerInput({
        name: "Alex",
        email: "not-an-email",
        grade: "4",
        level: "beginner",
        sessionIds: ["s1"],
      }),
    ).toBe("Enter a valid email.");

    expect(
      validatePlayerInput({
        name: "Alex",
        email: "alex@example.com",
        grade: "4",
        level: "beginner",
        sessionIds: [],
      }),
    ).toBe("Select at least one session.");
  });
});
