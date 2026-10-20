"use client";

import { useCallback, useEffect, useState } from "react";
import { sampleData } from "@/lib/sample-data";
import { sessionKey } from "@/lib/format";
import { seatsTaken } from "@/lib/programs";
import {
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
  apiUpdateProgram,
  apiUpdateClinic,
  apiUpdatePlayer,
  fetchRegistrationState,
} from "@/lib/registration-api";
import { normalizeRegistrationState } from "@/lib/storage";
import type { AppState, Session } from "@/lib/types";

export function usePlayerStore(
  orgId: string,
  initialState: AppState = sampleData,
) {
  const [state, setState] = useState<AppState>(() =>
    normalizeRegistrationState(initialState),
  );
  const [hydrated, setHydrated] = useState(false);

  const applyState = useCallback((next: AppState | undefined) => {
    if (next) setState(normalizeRegistrationState(next));
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchRegistrationState(orgId);
    applyState(next);
    return next;
  }, [applyState, orgId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchRegistrationState(orgId);
        if (!cancelled) applyState(next);
      } catch {
        if (!cancelled) applyState(sampleData);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyState, orgId]);

  const syncFromStorage = useCallback(() => {
    void refresh();
  }, [refresh]);

  const createPlayer = useCallback(
    async (input: PlayerInput) => {
      const result = await apiCreatePlayer(orgId, input);
      if (result.error || !result.state) return { error: result.error ?? "Failed." };
      applyState(result.state);
      return { error: null };
    },
    [applyState, orgId],
  );

  const editPlayer = useCallback(
    async (playerId: string, input: PlayerInput) => {
      const result = await apiUpdatePlayer(orgId, playerId, input);
      if (result.error || !result.state) return { error: result.error ?? "Failed." };
      applyState(result.state);
      return { error: null };
    },
    [applyState, orgId],
  );

  const removePlayer = useCallback(
    async (playerId: string) => {
      const result = await apiDeletePlayer(orgId, playerId);
      if (result.state) applyState(result.state);
    },
    [applyState, orgId],
  );

  const sendPaymentLink = useCallback(
    async (playerId: string) => {
      const result = await apiSendPaymentLink(orgId, playerId);
      if (result.state) applyState(result.state);
    },
    [applyState, orgId],
  );

  const createSession = useCallback(
    async (input: SessionInput) => {
      const result = await apiCreateClinic(orgId, input);
      if (result.error || !result.state) return { error: result.error ?? "Failed." };
      applyState(result.state);
      return { error: null };
    },
    [applyState, orgId],
  );

  const editSession = useCallback(
    async (sessionId: string, input: SessionInput) => {
      const result = await apiUpdateClinic(orgId, sessionId, input);
      if (result.error || !result.state) return { error: result.error ?? "Failed." };
      applyState(result.state);
      return { error: null };
    },
    [applyState, orgId],
  );

  const removeSession = useCallback(
    async (sessionId: string) => {
      const result = await apiDeleteClinic(orgId, sessionId);
      if (result.state) applyState(result.state);
    },
    [applyState, orgId],
  );

  const addChild = useCallback(
    async (input: ChildInput) => {
      const result = await apiAddChild(input);
      if (result.error || !result.child) {
        return { error: result.error ?? "Failed.", childId: null };
      }
      await refresh();
      return { error: null, childId: result.child.id };
    },
    [refresh],
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
      const result = await apiEnrollPaid(orgId, playerId, programId, clinicId, cart);
      if (result.error || !result.state) return { error: result.error ?? "Failed." };
      applyState(result.state);
      return { error: null };
    },
    [applyState, orgId],
  );

  const completePaidRegistration = useCallback(
    async (
      playerId: string,
      programId: string,
      clinicId: string,
      cart: import("@/lib/merchandise").CartLine[] = [],
    ) => {
      const result = await apiEnrollPaid(orgId, playerId, programId, clinicId, cart);
      if (result.error || !result.state) return { error: result.error ?? "Failed." };
      applyState(result.state);
      return { error: null };
    },
    [applyState, orgId],
  );

  const setProgramRegistrationOpen = useCallback(
    async (programId: string, open: boolean) => {
      const result = await apiSetProgramOpen(orgId, programId, open);
      if (result.state) applyState(result.state);
    },
    [applyState, orgId],
  );

  const updateProgramDetails = useCallback(
    async (programId: string, input: ProgramInput) => {
      const result = await apiUpdateProgram(orgId, programId, input);
      if (result.error || !result.state) {
        return { error: result.error ?? "Failed." };
      }
      applyState(result.state);
      return { error: null };
    },
    [applyState, orgId],
  );

  const createProgram = useCallback(
    async (input: ProgramInput) => {
      const result = await apiCreateProgram(orgId, input);
      if (result.error || !result.state) {
        return { error: result.error ?? "Failed.", programId: null };
      }
      applyState(result.state);
      return { error: null, programId: result.programId ?? null };
    },
    [applyState, orgId],
  );

  const removeFromProgram = useCallback(
    async (playerId: string, programId: string) => {
      const result = await apiRemoveFromProgram(orgId, playerId, programId);
      if (result.state) applyState(result.state);
    },
    [applyState, orgId],
  );

  const setClinicRegistrationAvailable = useCallback(
    async (clinicId: string, available: boolean) => {
      const result = await apiSetClinicAvailable(orgId, clinicId, available);
      if (result.state) applyState(result.state);
    },
    [applyState, orgId],
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
    updateProgramDetails,
    removeFromProgram,
    setProgramRegistrationOpen,
    setClinicRegistrationAvailable,
    countPlayersForSession: (sessionId: string) =>
      seatsTaken(state, sessionId),
    getSessionLabel: (session: Session) =>
      session.label ?? sessionKey(session.year, session.month),
  };
}
