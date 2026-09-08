import { describe, expect, it } from "vitest";
import { sampleData } from "@/lib/sample-data";
import {
  addChildForParent,
  addPlayer,
  addSession,
  deletePlayer,
  deleteSession,
  filterSessionsByYearMonth,
  getChildrenForParent,
  getVisiblePlayers,
  registerChildForClinic,
  setClinicAvailable,
  setProgramOpen,
  updatePlayer,
  updateSession,
  validateChildInput,
  validatePlayerInput,
} from "@/lib/player-store";

const winterClinic = sampleData.sessions.find(
  (session) => session.id === "session-2026-01",
)!;
const summerProgram = sampleData.programs.find(
  (program) => program.name === "Summer Camp 2026",
)!;

describe("sampleData", () => {
  it("loads programs, clinics, and parent children", () => {
    expect(sampleData.programs.length).toBeGreaterThanOrEqual(8);
    expect(sampleData.sessions).toHaveLength(13);
    expect(sampleData.players).toHaveLength(12);
    expect(summerProgram).toBeDefined();
    expect(
      sampleData.sessions.filter(
        (session) => session.programId === summerProgram.id,
      ),
    ).toHaveLength(6);
    expect(getChildrenForParent(sampleData.players, "user-1")).toHaveLength(2);
  });
});

describe("player-store", () => {
  it("filters sessions by year and month", () => {
    const state = {
      programs: sampleData.programs,
      sessions: [
        {
          id: "s1",
          programId: "p1",
          year: 2026,
          month: 1,
          status: "trending" as const,
          available: true,
        },
        {
          id: "s2",
          programId: "p1",
          year: 2026,
          month: 2,
          status: "in-progress" as const,
          available: true,
        },
        {
          id: "s3",
          programId: "p2",
          year: 2025,
          month: 12,
          status: "completed" as const,
          available: false,
        },
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
      programIds: [winterClinic.programId],
      sessionIds: [winterClinic.id],
    });
    expect(state.players).toHaveLength(13);

    const newPlayer = state.players.at(-1)!;
    state = updatePlayer(state, newPlayer.id, {
      ...newPlayer,
      grade: "5",
    });
    expect(state.players.at(-1)?.grade).toBe("5");

    state = deletePlayer(state, newPlayer.id);
    expect(state.players).toHaveLength(12);
  });

  it("adds, updates, and deletes sessions with player cleanup", () => {
    let state = sampleData;
    const sessionId = winterClinic.id;

    const duplicate = addSession(state, {
      programId: winterClinic.programId,
      year: 2026,
      month: 1,
      status: "trending",
    });
    expect("error" in duplicate).toBe(true);

    const added = addSession(state, {
      programId: winterClinic.programId,
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
      programId: newSession.programId,
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
    const visible = getVisiblePlayers(sampleData.players, [winterClinic.id]);
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

  it("lists children for a parent and registers them for available clinics", () => {
    const children = getChildrenForParent(sampleData.players, "user-1");
    expect(children.map((child) => child.name)).toEqual([
      "Lucas Rivera",
      "Maya Rivera",
    ]);

    const maya = children.find((child) => child.name === "Maya Rivera")!;
    const week1 = sampleData.sessions.find(
      (session) => session.label === "Week 1",
    )!;

    const registered = registerChildForClinic(
      sampleData,
      maya.id,
      summerProgram.id,
      week1.id,
    );
    expect("error" in registered).toBe(false);
    if ("error" in registered) return;

    const updatedMaya = registered.players.find(
      (player) => player.id === maya.id,
    );
    expect(updatedMaya?.programIds).toContain(summerProgram.id);
    expect(updatedMaya?.sessionIds).toEqual([week1.id]);

    const closed = setProgramOpen(sampleData, summerProgram.id, false);
    expect(
      registerChildForClinic(closed, maya.id, summerProgram.id, week1.id),
    ).toMatchObject({
      error: "This program is not open for registration.",
    });

    const week5 = sampleData.sessions.find(
      (session) => session.label === "Week 5",
    )!;
    expect(
      registerChildForClinic(sampleData, maya.id, summerProgram.id, week5.id),
    ).toMatchObject({
      error: "This clinic is not available for registration.",
    });

    const madeAvailable = setClinicAvailable(sampleData, week5.id, true);
    const week5Registered = registerChildForClinic(
      madeAvailable,
      maya.id,
      summerProgram.id,
      week5.id,
    );
    expect("error" in week5Registered).toBe(false);
  });

  it("adds a child for a parent account", () => {
    const next = addChildForParent(sampleData, "user-1", "user@demo.com", {
      name: "Nova Rivera",
      grade: "3",
      level: "beginner",
    });
    expect(next.players).toHaveLength(13);
    expect(next.players.at(-1)).toMatchObject({
      name: "Nova Rivera",
      parentUserId: "user-1",
      email: "user@demo.com",
      programIds: [],
      sessionIds: [],
    });
    expect(validateChildInput({ name: "", grade: "3", level: "beginner" })).toBe(
      "Name is required.",
    );
  });
});
