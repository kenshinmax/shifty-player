"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sampleData } from "./sample-data";
import {
  REGISTRATION_STORAGE_KEY,
  loadRegistrationState,
  parseRegistrationState,
  saveRegistrationState,
} from "./storage";
import {
  DEFAULT_CLINIC_CAPACITY,
  type AppState,
  type Level,
  type Player,
  type Session,
  type SessionStatus,
} from "./types";
import { sessionKey } from "./format";
import { getClinicCapacity, getRemainingClinicSpots } from "./programs";

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

/** Validates that a child can enroll in a clinic (does not mutate state). */
export function validateClinicRegistration(
  state: AppState,
  playerId: string,
  programId: string,
  clinicId: string,
): string | null {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) return "Player not found.";

  const program = state.programs.find((entry) => entry.id === programId);
  if (!program) return "Program not found.";
  if (!program.open) {
    return "This program is not open for registration.";
  }

  const clinic = state.sessions.find((entry) => entry.id === clinicId);
  if (!clinic) return "Clinic not found.";
  if (clinic.programId !== programId) {
    return "That clinic is not part of the selected program.";
  }
  if (!clinic.available) {
    return "This clinic is not available for registration.";
  }
  if (player.sessionIds.includes(clinicId)) {
    return "This child is already registered for that clinic.";
  }
  if (getRemainingClinicSpots(state.players, clinic) <= 0) {
    return "This clinic has no available spots.";
  }

  return null;
}

/**
 * Enrolls a child in a clinic. Prefer completePaidClinicRegistration so
 * enrollment only happens after payment succeeds.
 */
export function registerChildForClinic(
  state: AppState,
  playerId: string,
  programId: string,
  clinicId: string,
): AppState | { error: string } {
  const error = validateClinicRegistration(
    state,
    playerId,
    programId,
    clinicId,
  );
  if (error) return { error };

  const player = state.players.find((entry) => entry.id === playerId)!;

  return updatePlayer(state, playerId, {
    ...player,
    programIds: player.programIds.includes(programId)
      ? player.programIds
      : [...player.programIds, programId],
    sessionIds: [...player.sessionIds, clinicId],
  });
}

/**
 * Confirms payment and enrolls the child. In production this runs only after
 * Stripe reports a successful PaymentIntent (typically via webhook).
 */
export function completePaidClinicRegistration(
  state: AppState,
  playerId: string,
  programId: string,
  clinicId: string,
  paidAt: string = new Date().toISOString(),
): AppState | { error: string } {
  const registered = registerChildForClinic(
    state,
    playerId,
    programId,
    clinicId,
  );
  if ("error" in registered) return registered;
  return markPaymentLinkSent(registered, playerId, paidAt);
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

export type ProgramInput = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  open: boolean;
  spots: number;
  location?: string;
};

function parseIsoDateParts(iso: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

export function validateProgramInput(input: ProgramInput): string | null {
  if (!input.name.trim()) return "Program name is required.";
  if (!input.description.trim()) return "Description is required.";
  const start = parseIsoDateParts(input.startDate);
  const end = parseIsoDateParts(input.endDate);
  if (!start) return "Enter a valid start date.";
  if (!end) return "Enter a valid end date.";
  if (
    input.endDate.trim() < input.startDate.trim()
  ) {
    return "End date must be on or after the start date.";
  }
  if (!Number.isInteger(input.spots) || input.spots < 1) {
    return "Spots must be at least 1.";
  }
  return null;
}

export function addProgram(
  state: AppState,
  input: ProgramInput,
): AppState | { error: string } {
  const error = validateProgramInput(input);
  if (error) return { error };

  const start = parseIsoDateParts(input.startDate)!;
  const end = parseIsoDateParts(input.endDate)!;
  const id = `program-${crypto.randomUUID()}`;
  const spots = input.spots > 0 ? input.spots : DEFAULT_CLINIC_CAPACITY;

  const program = {
    id,
    name: input.name.trim(),
    description: input.description.trim(),
    year: start.year,
    status: "trending" as const,
    open: input.open,
    startMonth: start.month,
    endMonth: end.month,
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    location: input.location?.trim() || undefined,
    spots,
  };

  const clinicId = `session-${crypto.randomUUID()}`;
  const clinic = {
    id: clinicId,
    programId: id,
    year: start.year,
    month: start.month,
    label: input.name.trim(),
    status: "trending" as const,
    available: input.open,
    capacity: spots,
  };

  return {
    ...state,
    programs: [program, ...state.programs],
    sessions: [...state.sessions, clinic],
  };
}

export function removePlayerFromProgram(
  state: AppState,
  playerId: string,
  programId: string,
): AppState {
  const clinicIds = new Set(
    state.sessions
      .filter((session) => session.programId === programId)
      .map((session) => session.id),
  );

  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id !== playerId) return player;
      return {
        ...player,
        programIds: player.programIds.filter((id) => id !== programId),
        sessionIds: player.sessionIds.filter((id) => !clinicIds.has(id)),
      };
    }),
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
  session: Omit<Session, "id" | "available" | "capacity"> & {
    available?: boolean;
    capacity?: number;
  },
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
        capacity:
          session.capacity && session.capacity > 0
            ? session.capacity
            : DEFAULT_CLINIC_CAPACITY,
        id,
      },
    ],
  };
}

export function updateSession(
  state: AppState,
  sessionId: string,
  updates: Omit<Session, "id" | "available" | "capacity"> & {
    available?: boolean;
    capacity?: number;
  },
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
            capacity:
              updates.capacity && updates.capacity > 0
                ? updates.capacity
                : getClinicCapacity(session),
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
  const skipSaveRef = useRef(true);

  const persistState = useCallback((next: AppState) => {
    saveRegistrationState(next);
  }, []);

  const replaceStateFromStorage = useCallback(() => {
    skipSaveRef.current = true;
    setState(loadRegistrationState());
  }, []);

  useEffect(() => {
    skipSaveRef.current = true;
    setState(loadRegistrationState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    saveRegistrationState(state);
  }, [state, hydrated]);

  // Keep admin/parent views in sync when another tab updates registration data.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== REGISTRATION_STORAGE_KEY || event.newValue == null) {
        return;
      }
      const parsed = parseRegistrationState(event.newValue);
      if (!parsed) return;
      skipSaveRef.current = true;
      setState(parsed);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commitState = useCallback(
    (updater: (current: AppState) => AppState) => {
      setState((current) => {
        const next = updater(current);
        if (next !== current) {
          persistState(next);
        }
        return next;
      });
    },
    [persistState],
  );

  const syncFromStorage = useCallback(() => {
    replaceStateFromStorage();
  }, [replaceStateFromStorage]);
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
    commitState((current) => markPaymentLinkSent(current, playerId));
  }, [commitState]);

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

  const validateRegistration = useCallback(
    (playerId: string, programId: string, clinicId: string) => {
      return {
        error: validateClinicRegistration(state, playerId, programId, clinicId),
      };
    },
    [state],
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

  const completePaidRegistration = useCallback(
    (playerId: string, programId: string, clinicId: string) => {
      let registerError: string | undefined;
      commitState((current) => {
        const player = current.players.find((entry) => entry.id === playerId);
        const alreadyEnrolled =
          Boolean(player?.sessionIds.includes(clinicId)) &&
          Boolean(player?.paymentLinkSentAt);

        if (alreadyEnrolled) {
          // Idempotent success for Strict Mode double-updates / retries.
          return current;
        }

        const result = completePaidClinicRegistration(
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
    [commitState],
  );

  const setProgramRegistrationOpen = useCallback(
    (programId: string, open: boolean) => {
      setState((current) => setProgramOpen(current, programId, open));
    },
    [],
  );

  const createProgram = useCallback((input: ProgramInput) => {
    let createError: string | undefined;
    let programId: string | null = null;
    setState((current) => {
      const result = addProgram(current, input);
      if ("error" in result) {
        createError = result.error;
        return current;
      }
      programId = result.programs[0]?.id ?? null;
      return result;
    });
    return createError
      ? { error: createError, programId: null }
      : { error: null, programId };
  }, []);

  const removeFromProgram = useCallback(
    (playerId: string, programId: string) => {
      setState((current) =>
        removePlayerFromProgram(current, playerId, programId),
      );
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
    syncFromStorage,
    createPlayer,
    editPlayer,
    removePlayer,
    sendPaymentLink,
    createSession,
    editSession,
    removeSession,
    addChild,
    validateRegistration,
    registerForClinic,
    completePaidRegistration,
    createProgram,
    removeFromProgram,
    setProgramRegistrationOpen,
    setClinicRegistrationAvailable,
    countPlayersForSession: (sessionId: string) =>
      countPlayersForSession(state.players, sessionId),
    getSessionLabel: (session: Session) =>
      session.label ?? sessionKey(session.year, session.month),
  };
}
