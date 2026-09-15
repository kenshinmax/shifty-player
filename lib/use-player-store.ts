"use client";

import { useCallback, useEffect, useState } from "react";
import { sampleData } from "@/lib/sample-data";
import { sessionKey } from "@/lib/format";
import {
  countPlayersForSession,
  validateClinicRegistration,
  type ChildInput,
  type PlayerInput,
  type ProgramInput,
  type SessionInput,
} from "@/lib/player-store";
import {
  apiAddChild,
  apiCreateClinic,
  apiCreatePlayer,
  apiCreateProgram,
  apiDeleteClinic,
  apiDeletePlayer,
  apiEnrollPaid,
  apiRemoveFromProgram,
  apiSendPaymentLink,
  apiSetClinicAvailable,
  apiSetProgramOpen,
  apiUpdateClinic,
  apiUpdatePlayer,
  fetchRegistrationState,
} from "@/lib/registration-api";
import type { AppState, Session } from "@/lib/types";

export function usePlayerStore(initialState: AppState = sampleData) {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const next = await fetchRegistrationState();
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchRegistrationState();
        if (!cancelled) setState(next);
      } catch {
        if (!cancelled) setState(sampleData);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyState = useCallback((next: AppState | undefined) => {
    if (next) setState(next);
  }, []);

  const syncFromStorage = useCallback(() => {
    void refresh();
  }, [refresh]);

  const createPlayer = useCallback(
    async (input: PlayerInput) => {
      const result = await apiCreatePlayer(input);
      if (result.error || !result.state) return { error: result.error ?? "Failed." };
      applyState(result.state);
      return { error: null };
    },
    [applyState],
  );

  const editPlayer = useCallback(
    async (playerId: string, input: PlayerInput) => {
      const result = await apiUpdatePlayer(playerId, input);
      if (result.error || !result.state) return { error: result.error ?? "Failed." };
      applyState(result.state);
      return { error: null };
    },
    [applyState],
  );

  const removePlayer = useCallback(
    async (playerId: string) => {
      const result = await apiDeletePlayer(playerId);
      if (result.state) applyState(result.state);
    },
    [applyState],
  );

  const sendPaymentLink = useCallback(
    async (playerId: string) => {
      const result = await apiSendPaymentLink(playerId);
      if (result.state) applyState(result.state);
    },
    [applyState],
  );

  const createSession = useCallback(
    async (input: SessionInput) => {
      const result = await apiCreateClinic(input);
      if (result.error || !result.state) return { error: result.error ?? "Failed." };
      applyState(result.state);
      return { error: null };
    },
    [applyState],
  );

  const editSession = useCallback(
    async (sessionId: string, input: SessionInput) => {
      const result = await apiUpdateClinic(sessionId, input);
      if (result.error || !result.state) return { error: result.error ?? "Failed." };
      applyState(result.state);
      return { error: null };
    },
    [applyState],
  );

  const removeSession = useCallback(
    async (sessionId: string) => {
      const result = await apiDeleteClinic(sessionId);
      if (result.state) applyState(result.state);
    },
    [applyState],
  );

  const addChild = useCallback(
    async (parentUserId: string, parentEmail: string, input: ChildInput) => {
      const result = await apiAddChild(parentUserId, parentEmail, input);
      if (result.error || !result.state) {
        return { error: result.error ?? "Failed.", childId: null };
      }
      applyState(result.state);
      return { error: null, childId: result.childId ?? null };
    },
    [applyState],
  );

  const validateRegistration = useCallback(
    (playerId: string, programId: string, clinicId: string) => ({
      error: validateClinicRegistration(state, playerId, programId, clinicId),
    }),
    [state],
  );

  const registerForClinic = useCallback(
    async (
      playerId: string,
      programId: string,
      clinicId: string,
      cart: import("@/lib/merchandise").CartLine[] = [],
    ) => {
      const result = await apiEnrollPaid(playerId, programId, clinicId, cart);
      if (result.error || !result.state) return { error: result.error ?? "Failed." };
      applyState(result.state);
      return { error: null };
    },
    [applyState],
  );

  const completePaidRegistration = useCallback(
    async (
      playerId: string,
      programId: string,
      clinicId: string,
      cart: import("@/lib/merchandise").CartLine[] = [],
    ) => {
      const result = await apiEnrollPaid(playerId, programId, clinicId, cart);
      if (result.error || !result.state) return { error: result.error ?? "Failed." };
      applyState(result.state);
      return { error: null };
    },
    [applyState],
  );

  const setProgramRegistrationOpen = useCallback(
    async (programId: string, open: boolean) => {
      const result = await apiSetProgramOpen(programId, open);
      if (result.state) applyState(result.state);
    },
    [applyState],
  );

  const createProgram = useCallback(
    async (input: ProgramInput) => {
      const result = await apiCreateProgram(input);
      if (result.error || !result.state) {
        return { error: result.error ?? "Failed.", programId: null };
      }
      applyState(result.state);
      return { error: null, programId: result.programId ?? null };
    },
    [applyState],
  );

  const removeFromProgram = useCallback(
    async (playerId: string, programId: string) => {
      const result = await apiRemoveFromProgram(playerId, programId);
      if (result.state) applyState(result.state);
    },
    [applyState],
  );

  const setClinicRegistrationAvailable = useCallback(
    async (clinicId: string, available: boolean) => {
      const result = await apiSetClinicAvailable(clinicId, available);
      if (result.state) applyState(result.state);
    },
    [applyState],
  );

  return {
    state,
    hydrated,
    syncFromStorage,
    refresh,
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
