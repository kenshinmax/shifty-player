"use client";

import { useCallback, useEffect, useState } from "react";
import { sampleData } from "./sample-data";
import { loadRegistrationState, saveRegistrationState } from "./storage";
import type { AppState, Level, Player, Session, SessionStatus } from "./types";
import { sessionKey } from "./format";

export function filterSessionsByYearMonth(
  sessions: Session[],
  year: number | null,
  month: number | null,
): Session[] {
  return sessions.filter((session) => {
    if (year !== null && session.year !== year) return false;
    if (month !== null && session.month !== month) return false;
    return true;
  });
}

export function getVisiblePlayers(
  players: Player[],
  visibleSessionIds: string[],
): Player[] {
  if (visibleSessionIds.length === 0) return [];
  return players.filter((player) =>
    player.sessionIds.some((id) => visibleSessionIds.includes(id)),
  );
}

export function getChildrenForParent(
  players: Player[],
  parentUserId: string,
): Player[] {
  return players
    .filter((player) => player.parentUserId === parentUserId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function registerChildForClinic(
  state: AppState,
  playerId: string,
  programId: string,
  clinicId: string,
): AppState | { error: string } {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) return { error: "Player not found." };

  const program = state.programs.find((entry) => entry.id === programId);
  if (!program) return { error: "Program not found." };
  if (!program.open) {
    return { error: "This program is not open for registration." };
  }

  const clinic = state.sessions.find((entry) => entry.id === clinicId);
  if (!clinic) return { error: "Clinic not found." };
  if (clinic.programId !== programId) {
    return { error: "That clinic is not part of the selected program." };
  }
  if (!clinic.available) {
    return { error: "This clinic is not available for registration." };
  }
  if (player.sessionIds.includes(clinicId)) {
    return { error: "This child is already registered for that clinic." };
  }

  return updatePlayer(state, playerId, {
    ...player,
    programIds: player.programIds.includes(programId)
      ? player.programIds
      : [...player.programIds, programId],
    sessionIds: [...player.sessionIds, clinicId],
  });
}

export function setProgramOpen(
  state: AppState,
  programId: string,
  open: boolean,
): AppState {
  return {
    ...state,
    programs: state.programs.map((program) =>
      program.id === programId ? { ...program, open } : program,
    ),
  };
}

export function setClinicAvailable(
  state: AppState,
  clinicId: string,
  available: boolean,
): AppState {
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === clinicId ? { ...session, available } : session,
    ),
  };
}

export function countPlayersForSession(
  players: Player[],
  sessionId: string,
): number {
  return players.filter((player) => player.sessionIds.includes(sessionId))
    .length;
}

export function findDuplicateSession(
  sessions: Session[],
  year: number,
  month: number,
  week?: number,
  excludeId?: string,
): Session | undefined {
  return sessions.find(
    (session) =>
      session.year === year &&
      session.month === month &&
      (session.week ?? undefined) === (week ?? undefined) &&
      session.id !== excludeId,
  );
}

export function addPlayer(
  state: AppState,
  player: Omit<Player, "id">,
): AppState {
  const id = `player-${crypto.randomUUID()}`;
  return {
    ...state,
    players: [...state.players, { ...player, id }],
  };
}

export function updatePlayer(
  state: AppState,
  playerId: string,
  updates: Omit<Player, "id">,
): AppState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, ...updates, id: playerId } : player,
    ),
  };
}

export function deletePlayer(state: AppState, playerId: string): AppState {
  return {
    ...state,
    players: state.players.filter((player) => player.id !== playerId),
  };
}

export function addSession(
  state: AppState,
  session: Omit<Session, "id" | "available"> & { available?: boolean },
): AppState | { error: string } {
  if (
    findDuplicateSession(
      state.sessions,
      session.year,
      session.month,
      session.week,
    )
  ) {
    return { error: "A clinic already exists for that week and month." };
  }

  const id = `session-${crypto.randomUUID()}`;
  return {
    ...state,
    sessions: [
      ...state.sessions,
      {
        ...session,
        available: session.available ?? true,
        id,
      },
    ],
  };
}

export function updateSession(
  state: AppState,
  sessionId: string,
  updates: Omit<Session, "id" | "available"> & { available?: boolean },
): AppState | { error: string } {
  if (
    findDuplicateSession(
      state.sessions,
      updates.year,
      updates.month,
      updates.week,
      sessionId,
    )
  ) {
    return { error: "A clinic already exists for that week and month." };
  }

  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            ...updates,
            available: updates.available ?? session.available,
            id: sessionId,
          }
        : session,
    ),
  };
}

export function deleteSession(state: AppState, sessionId: string): AppState {
  return {
    ...state,
    sessions: state.sessions.filter((session) => session.id !== sessionId),
    players: state.players.map((player) => ({
      ...player,
      sessionIds: player.sessionIds.filter((id) => id !== sessionId),
    })),
  };
}

export function markPaymentLinkSent(
  state: AppState,
  playerId: string,
  sentAt: string = new Date().toISOString(),
): AppState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? { ...player, paymentLinkSentAt: sentAt }
        : player,
    ),
  };
}

export type PlayerInput = {
  name: string;
  email: string;
  grade: string;
  level: Level;
  sessionIds: string[];
  parentUserId?: string;
};

export type ChildInput = {
  name: string;
  grade: string;
  level: Level;
};

export function validateChildInput(input: ChildInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!input.grade.trim()) return "Grade is required.";
  if (!input.level) return "Level is required.";
  return null;
}

export function addChildForParent(
  state: AppState,
  parentUserId: string,
  parentEmail: string,
  input: ChildInput,
): AppState {
  return addPlayer(state, {
    name: input.name.trim(),
    email: parentEmail.trim().toLowerCase(),
    grade: input.grade.trim(),
    level: input.level,
    programIds: [],
    sessionIds: [],
    parentUserId,
    avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(input.name.trim())}&size=80`,
  });
}

function programIdsForSessions(
  sessions: Session[],
  sessionIds: string[],
): string[] {
  return [
    ...new Set(
      sessionIds
        .map(
          (sessionId) =>
            sessions.find((session) => session.id === sessionId)?.programId,
        )
        .filter((programId): programId is string => Boolean(programId)),
    ),
  ];
}

export function validatePlayerInput(input: PlayerInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!input.email.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return "Enter a valid email.";
  }
  if (!input.grade.trim()) return "Grade is required.";
  if (!input.level) return "Level is required.";
  if (input.sessionIds.length === 0) return "Select at least one session.";
  return null;
}

export type SessionInput = {
  year: number;
  month: number;
  label?: string;
  status?: SessionStatus;
  programId?: string;
  week?: number;
};

export function validateSessionInput(input: SessionInput): string | null {
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    return "Enter a valid year.";
  }
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    return "Enter a valid month.";
  }
  return null;
}

export function usePlayerStore(initialState: AppState = sampleData) {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadRegistrationState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveRegistrationState(state);
  }, [state, hydrated]);

  const createPlayer = useCallback((input: PlayerInput) => {
    const error = validatePlayerInput(input);
    if (error) return { error };

    setState((current) =>
      addPlayer(current, {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        grade: input.grade.trim(),
        level: input.level,
        programIds: programIdsForSessions(current.sessions, input.sessionIds),
        sessionIds: input.sessionIds,
        parentUserId: input.parentUserId,
        avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(input.name.trim())}&size=80`,
      }),
    );
    return { error: null };
  }, []);

  const editPlayer = useCallback((playerId: string, input: PlayerInput) => {
    const error = validatePlayerInput(input);
    if (error) return { error };

    setState((current) => {
      const existing = current.players.find((player) => player.id === playerId);
      return updatePlayer(current, playerId, {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        grade: input.grade.trim(),
        level: input.level,
        programIds: programIdsForSessions(current.sessions, input.sessionIds),
        sessionIds: input.sessionIds,
        parentUserId: existing?.parentUserId,
        paymentLinkSentAt: existing?.paymentLinkSentAt,
        avatarUrl: existing?.avatarUrl,
      });
    });
    return { error: null };
  }, []);

  const removePlayer = useCallback((playerId: string) => {
    setState((current) => deletePlayer(current, playerId));
  }, []);

  const sendPaymentLink = useCallback((playerId: string) => {
    setState((current) => markPaymentLinkSent(current, playerId));
  }, []);

  const createSession = useCallback((input: SessionInput) => {
    const error = validateSessionInput(input);
    if (error) return { error };

    let addError: string | undefined;
    setState((current) => {
      const programId =
        input.programId ??
        current.programs.find((program) => program.status === "trending")?.id ??
        current.programs[0]?.id;
      if (!programId) {
        addError = "Create a program before adding clinics.";
        return current;
      }

      const result = addSession(current, {
        programId,
        year: input.year,
        month: input.month,
        week: input.week,
        label: input.label?.trim() || undefined,
        status: input.status ?? "trending",
      });
      if ("error" in result) {
        addError = result.error;
        return current;
      }
      return result;
    });

    return addError ? { error: addError } : { error: null };
  }, []);

  const editSession = useCallback((sessionId: string, input: SessionInput) => {
    const error = validateSessionInput(input);
    if (error) return { error };

    let editError: string | undefined;
    setState((current) => {
      const existing = current.sessions.find(
        (session) => session.id === sessionId,
      );
      const result = updateSession(current, sessionId, {
        programId: input.programId ?? existing?.programId ?? current.programs[0]?.id ?? "",
        year: input.year,
        month: input.month,
        week: input.week ?? existing?.week,
        label: input.label?.trim() || undefined,
        status: input.status ?? existing?.status ?? "trending",
      });
      if ("error" in result) {
        editError = result.error;
        return current;
      }
      return result;
    });

    return editError ? { error: editError } : { error: null };
  }, []);

  const removeSession = useCallback((sessionId: string) => {
    setState((current) => deleteSession(current, sessionId));
  }, []);

  const addChild = useCallback(
    (parentUserId: string, parentEmail: string, input: ChildInput) => {
      const error = validateChildInput(input);
      if (error) return { error, childId: null };

      let childId: string | null = null;
      setState((current) => {
        const next = addChildForParent(
          current,
          parentUserId,
          parentEmail,
          input,
        );
        childId = next.players.at(-1)?.id ?? null;
        return next;
      });
      return { error: null, childId };
    },
    [],
  );

  const registerForClinic = useCallback(
    (playerId: string, programId: string, clinicId: string) => {
      let registerError: string | undefined;
      setState((current) => {
        const result = registerChildForClinic(
          current,
          playerId,
          programId,
          clinicId,
        );
        if ("error" in result) {
          registerError = result.error;
          return current;
        }
        return result;
      });
      return registerError ? { error: registerError } : { error: null };
    },
    [],
  );

  const setProgramRegistrationOpen = useCallback(
    (programId: string, open: boolean) => {
      setState((current) => setProgramOpen(current, programId, open));
    },
    [],
  );

  const setClinicRegistrationAvailable = useCallback(
    (clinicId: string, available: boolean) => {
      setState((current) => setClinicAvailable(current, clinicId, available));
    },
    [],
  );

  return {
    state,
    createPlayer,
    editPlayer,
    removePlayer,
    sendPaymentLink,
    createSession,
    editSession,
    removeSession,
    addChild,
    registerForClinic,
    setProgramRegistrationOpen,
    setClinicRegistrationAvailable,
    countPlayersForSession: (sessionId: string) =>
      countPlayersForSession(state.players, sessionId),
    getSessionLabel: (session: Session) =>
      session.label ?? sessionKey(session.year, session.month),
  };
}
