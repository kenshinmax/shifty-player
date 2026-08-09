"use client";

import { useCallback, useState } from "react";
import { sampleData } from "./sample-data";
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
  excludeId?: string,
): Session | undefined {
  return sessions.find(
    (session) =>
      session.year === year &&
      session.month === month &&
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
  session: Omit<Session, "id">,
): AppState | { error: string } {
  if (findDuplicateSession(state.sessions, session.year, session.month)) {
    return { error: "A session already exists for that year and month." };
  }

  const id = `session-${crypto.randomUUID()}`;
  return {
    ...state,
    sessions: [...state.sessions, { ...session, id }],
  };
}

export function updateSession(
  state: AppState,
  sessionId: string,
  updates: Omit<Session, "id">,
): AppState | { error: string } {
  if (
    findDuplicateSession(
      state.sessions,
      updates.year,
      updates.month,
      sessionId,
    )
  ) {
    return { error: "A session already exists for that year and month." };
  }

  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === sessionId
        ? { ...session, ...updates, id: sessionId }
        : session,
    ),
  };
}

export function deleteSession(state: AppState, sessionId: string): AppState {
  return {
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
};

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

  const createPlayer = useCallback((input: PlayerInput) => {
    const error = validatePlayerInput(input);
    if (error) return { error };

    setState((current) =>
      addPlayer(current, {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        grade: input.grade.trim(),
        level: input.level,
        sessionIds: input.sessionIds,
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
        sessionIds: input.sessionIds,
        paymentLinkSentAt: existing?.paymentLinkSentAt,
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
      const result = addSession(current, {
        year: input.year,
        month: input.month,
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
        year: input.year,
        month: input.month,
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

  return {
    state,
    createPlayer,
    editPlayer,
    removePlayer,
    sendPaymentLink,
    createSession,
    editSession,
    removeSession,
    countPlayersForSession: (sessionId: string) =>
      countPlayersForSession(state.players, sessionId),
    getSessionLabel: (session: Session) =>
      session.label ?? sessionKey(session.year, session.month),
  };
}
