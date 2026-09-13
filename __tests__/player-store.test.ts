import { describe, expect, it } from "vitest";
import { sampleData } from "@/lib/sample-data";
import {
  addProgram,
  addChildForParent,
  addPlayer,
  addSession,
  completePaidClinicRegistration,
  deletePlayer,
  deleteSession,
  filterSessionsByYearMonth,
  getChildrenForParent,
  getVisiblePlayers,
  registerChildForClinic,
  removePlayerFromProgram,
  setClinicAvailable,
  setProgramOpen,
  updatePlayer,
  updateSession,
  validateChildInput,
  validateClinicRegistration,
  validatePlayerInput,
  validateProgramInput,
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
          capacity: 50,
        },
        {
          id: "s2",
          programId: "p1",
          year: 2026,
          month: 2,
          status: "in-progress" as const,
          available: true,
          capacity: 50,
        },
        {
          id: "s3",
          programId: "p2",
          year: 2025,
          month: 12,
          status: "completed" as const,
          available: false,
          capacity: 50,
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

  it("only marks clinic enrollment paid after payment completion", () => {
    const maya = sampleData.players.find(
      (player) => player.name === "Maya Rivera",
    )!;
    const week1 = sampleData.sessions.find(
      (session) => session.label === "Week 1",
    )!;

    expect(
      validateClinicRegistration(
        sampleData,
        maya.id,
        summerProgram.id,
        week1.id,
      ),
    ).toBeNull();
    expect(maya.sessionIds).not.toContain(week1.id);

    const paid = completePaidClinicRegistration(
      sampleData,
      maya.id,
      summerProgram.id,
      week1.id,
      "2026-07-01T12:00:00.000Z",
    );
    expect("error" in paid).toBe(false);
    if ("error" in paid) return;

    const updated = paid.players.find((player) => player.id === maya.id);
    expect(updated?.sessionIds).toContain(week1.id);
    expect(updated?.programIds).toContain(summerProgram.id);
    expect(updated?.paymentLinkSentAt).toBe("2026-07-01T12:00:00.000Z");
  });

  it("blocks registration when a clinic has no remaining spots", () => {
    const maya = sampleData.players.find(
      (player) => player.name === "Maya Rivera",
    )!;
    const week1 = sampleData.sessions.find(
      (session) => session.label === "Week 1",
    )!;
    const fullClinic = { ...week1, capacity: 1 };
    const occupied: typeof sampleData = {
      ...sampleData,
      sessions: sampleData.sessions.map((session) =>
        session.id === week1.id ? fullClinic : session,
      ),
      players: sampleData.players.map((player) =>
        player.id === "player-1"
          ? { ...player, sessionIds: [...player.sessionIds, week1.id] }
          : player,
      ),
    };

    expect(
      validateClinicRegistration(
        occupied,
        maya.id,
        summerProgram.id,
        week1.id,
      ),
    ).toBe("This clinic has no available spots.");
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

  it("creates a program with a starting clinic and roster removal", () => {
    expect(
      validateProgramInput({
        name: "",
        description: "Demo",
        startDate: "2027-03-01",
        endDate: "2027-03-31",
        open: true,
        spots: 50,
      }),
    ).toBe("Program name is required.");

    const created = addProgram(sampleData, {
      name: "Spring Skills 2027",
      description: "Spring training for rising players.",
      startDate: "2027-03-01",
      endDate: "2027-03-31",
      open: true,
      spots: 40,
    });
    expect("error" in created).toBe(false);
    if ("error" in created) return;

    const program = created.programs[0];
    expect(program).toMatchObject({
      name: "Spring Skills 2027",
      description: "Spring training for rising players.",
      open: true,
      spots: 40,
      startDate: "2027-03-01",
      endDate: "2027-03-31",
      startMonth: 3,
      endMonth: 3,
      year: 2027,
    });
    const clinic = created.sessions.find(
      (session) => session.programId === program.id,
    );
    expect(clinic).toMatchObject({
      available: true,
      capacity: 40,
      month: 3,
      year: 2027,
    });

    const withPlayer = addPlayer(created, {
      name: "Roster Player",
      email: "roster@example.com",
      grade: "6",
      level: "beginner",
      programIds: [program.id],
      sessionIds: [clinic!.id],
    });
    const player = withPlayer.players.at(-1)!;
    const removed = removePlayerFromProgram(withPlayer, player.id, program.id);
    const updated = removed.players.find((entry) => entry.id === player.id);
    expect(updated?.programIds).not.toContain(program.id);
    expect(updated?.sessionIds).not.toContain(clinic!.id);
  });
});
