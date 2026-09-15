import { normalizeRegistrationState } from "@/lib/storage";
import { sampleData } from "@/lib/sample-data";
import { getDb, isMongoConfigured } from "@/lib/mongo";
import type { AppState, Player, Program, Session } from "@/lib/types";
import {
  addChildForParent,
  addPlayer,
  addProgram,
  addSession,
  completePaidClinicRegistration,
  deletePlayer,
  deleteSession,
  markPaymentLinkSent,
  removePlayerFromProgram,
  setClinicAvailable,
  setProgramOpen,
  updatePlayer,
  updateSession,
  type ChildInput,
  type PlayerInput,
  type ProgramInput,
  type SessionInput,
  validateChildInput,
  validatePlayerInput,
  validateProgramInput,
  validateSessionInput,
} from "@/lib/player-store";

const PROGRAMS = "programs";
const SESSIONS = "sessions";
const PLAYERS = "players";
const PROCESSED_PAYMENTS = "processed_payments";

type MemoryDb = {
  programs: Program[];
  sessions: Session[];
  players: Player[];
  processedPaymentIds: Set<string>;
};

type MemoryGlobal = typeof globalThis & {
  __shiftyRegistrationMemory?: MemoryDb;
};

function getMemoryDb(): MemoryDb {
  const g = globalThis as MemoryGlobal;
  if (!g.__shiftyRegistrationMemory) {
    const seeded = normalizeRegistrationState(
      structuredClone(sampleData) as AppState,
    );
    g.__shiftyRegistrationMemory = {
      programs: seeded.programs,
      sessions: seeded.sessions,
      players: seeded.players,
      processedPaymentIds: new Set(),
    };
  }
  return g.__shiftyRegistrationMemory;
}

/** Reset in-memory registration DB (tests / seed). */
export function resetMemoryRegistrationDb(state: AppState = sampleData): void {
  const seeded = normalizeRegistrationState(structuredClone(state) as AppState);
  const g = globalThis as MemoryGlobal;
  g.__shiftyRegistrationMemory = {
    programs: seeded.programs,
    sessions: seeded.sessions,
    players: seeded.players,
    processedPaymentIds: new Set(),
  };
}

function stripMongoId<T extends { id: string }>(
  doc: T & { _id?: unknown },
): T {
  const { _id: _ignored, ...rest } = doc;
  return rest as T;
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

async function readAppState(): Promise<AppState> {
  if (!isMongoConfigured()) {
    const memory = getMemoryDb();
    return normalizeRegistrationState({
      programs: memory.programs,
      sessions: memory.sessions,
      players: memory.players,
    });
  }

  const db = await getDb();
  const [programs, sessions, players] = await Promise.all([
    db.collection(PROGRAMS).find({}).toArray(),
    db.collection(SESSIONS).find({}).toArray(),
    db.collection(PLAYERS).find({}).toArray(),
  ]);

  if (programs.length === 0 && sessions.length === 0 && players.length === 0) {
    await writeAppState(sampleData);
    return normalizeRegistrationState(structuredClone(sampleData) as AppState);
  }

  return normalizeRegistrationState({
    programs: programs.map((doc) =>
      stripMongoId(doc as unknown as Program & { _id?: unknown }),
    ),
    sessions: sessions.map((doc) =>
      stripMongoId(doc as unknown as Session & { _id?: unknown }),
    ),
    players: players.map((doc) =>
      stripMongoId(doc as unknown as Player & { _id?: unknown }),
    ),
  });
}

async function writeAppState(state: AppState): Promise<void> {
  const normalized = normalizeRegistrationState(state);

  if (!isMongoConfigured()) {
    const memory = getMemoryDb();
    memory.programs = normalized.programs;
    memory.sessions = normalized.sessions;
    memory.players = normalized.players;
    return;
  }

  const db = await getDb();
  await Promise.all([
    db.collection(PROGRAMS).deleteMany({}),
    db.collection(SESSIONS).deleteMany({}),
    db.collection(PLAYERS).deleteMany({}),
  ]);

  if (normalized.programs.length > 0) {
    await db.collection(PROGRAMS).insertMany(
      normalized.programs as unknown as import("mongodb").OptionalId<
        import("mongodb").Document
      >[],
    );
  }
  if (normalized.sessions.length > 0) {
    await db.collection(SESSIONS).insertMany(
      normalized.sessions as unknown as import("mongodb").OptionalId<
        import("mongodb").Document
      >[],
    );
  }
  if (normalized.players.length > 0) {
    await db.collection(PLAYERS).insertMany(
      normalized.players as unknown as import("mongodb").OptionalId<
        import("mongodb").Document
      >[],
    );
  }
}

async function mutateAppState(
  mutator: (state: AppState) => AppState | { error: string },
): Promise<{ state: AppState } | { error: string }> {
  const current = await readAppState();
  const result = mutator(current);
  if ("error" in result) return { error: result.error };
  await writeAppState(result);
  return { state: result };
}

export async function getRegistrationState(): Promise<AppState> {
  return readAppState();
}

export async function seedRegistrationState(
  state: AppState = sampleData,
): Promise<AppState> {
  const next = normalizeRegistrationState(structuredClone(state) as AppState);
  await writeAppState(next);
  if (!isMongoConfigured()) {
    resetMemoryRegistrationDb(next);
  } else {
    // Clear processed payments on full seed so e2e is deterministic.
    const db = await getDb();
    await db.collection(PROCESSED_PAYMENTS).deleteMany({});
  }
  return next;
}

export async function createProgramInDb(
  input: ProgramInput,
): Promise<{ state: AppState; programId: string } | { error: string }> {
  const validationError = validateProgramInput(input);
  if (validationError) return { error: validationError };

  let programId: string | null = null;
  const result = await mutateAppState((state) => {
    const next = addProgram(state, input);
    if ("error" in next) return next;
    programId = next.programs[0]?.id ?? null;
    return next;
  });
  if ("error" in result) return result;
  if (!programId) return { error: "Failed to create program." };
  return { state: result.state, programId };
}

export async function setProgramOpenInDb(
  programId: string,
  open: boolean,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState((state) => {
    if (!state.programs.some((program) => program.id === programId)) {
      return { error: "Program not found." };
    }
    return setProgramOpen(state, programId, open);
  });
}

export async function createClinicInDb(
  input: SessionInput,
): Promise<{ state: AppState } | { error: string }> {
  const validationError = validateSessionInput(input);
  if (validationError) return { error: validationError };

  return mutateAppState((state) => {
    const programId =
      input.programId ??
      state.programs.find((program) => program.status === "trending")?.id ??
      state.programs[0]?.id;
    if (!programId) {
      return { error: "Create a program before adding clinics." };
    }
    return addSession(state, {
      programId,
      year: input.year,
      month: input.month,
      week: input.week,
      label: input.label?.trim() || undefined,
      status: input.status ?? "trending",
    });
  });
}

export async function updateClinicInDb(
  clinicId: string,
  input: SessionInput,
): Promise<{ state: AppState } | { error: string }> {
  const validationError = validateSessionInput(input);
  if (validationError) return { error: validationError };

  return mutateAppState((state) => {
    const existing = state.sessions.find((session) => session.id === clinicId);
    if (!existing) return { error: "Clinic not found." };
    return updateSession(state, clinicId, {
      programId: input.programId ?? existing.programId,
      year: input.year,
      month: input.month,
      week: input.week ?? existing.week,
      label: input.label?.trim() || undefined,
      status: input.status ?? existing.status,
    });
  });
}

export async function deleteClinicInDb(
  clinicId: string,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState((state) => {
    if (!state.sessions.some((session) => session.id === clinicId)) {
      return { error: "Clinic not found." };
    }
    return deleteSession(state, clinicId);
  });
}

export async function setClinicAvailableInDb(
  clinicId: string,
  available: boolean,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState((state) => {
    if (!state.sessions.some((session) => session.id === clinicId)) {
      return { error: "Clinic not found." };
    }
    return setClinicAvailable(state, clinicId, available);
  });
}

export async function createPlayerInDb(
  input: PlayerInput,
): Promise<{ state: AppState } | { error: string }> {
  const validationError = validatePlayerInput(input);
  if (validationError) return { error: validationError };

  return mutateAppState((state) =>
    addPlayer(state, {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      grade: input.grade.trim(),
      level: input.level,
      programIds: programIdsForSessions(state.sessions, input.sessionIds),
      sessionIds: input.sessionIds,
      parentUserId: input.parentUserId,
      avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(input.name.trim())}&size=80`,
    }),
  );
}

export async function updatePlayerInDb(
  playerId: string,
  input: PlayerInput,
): Promise<{ state: AppState } | { error: string }> {
  const validationError = validatePlayerInput(input);
  if (validationError) return { error: validationError };

  return mutateAppState((state) => {
    const existing = state.players.find((player) => player.id === playerId);
    if (!existing) return { error: "Player not found." };
    return updatePlayer(state, playerId, {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      grade: input.grade.trim(),
      level: input.level,
      programIds: programIdsForSessions(state.sessions, input.sessionIds),
      sessionIds: input.sessionIds,
      parentUserId: existing.parentUserId,
      paymentLinkSentAt: existing.paymentLinkSentAt,
      avatarUrl: existing.avatarUrl,
    });
  });
}

export async function deletePlayerInDb(
  playerId: string,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState((state) => {
    if (!state.players.some((player) => player.id === playerId)) {
      return { error: "Player not found." };
    }
    return deletePlayer(state, playerId);
  });
}

export async function addChildInDb(
  parentUserId: string,
  parentEmail: string,
  input: ChildInput,
): Promise<{ state: AppState; childId: string } | { error: string }> {
  const validationError = validateChildInput(input);
  if (validationError) return { error: validationError };

  let childId: string | null = null;
  const result = await mutateAppState((state) => {
    const next = addChildForParent(state, parentUserId, parentEmail, input);
    childId = next.players.at(-1)?.id ?? null;
    return next;
  });
  if ("error" in result) return result;
  if (!childId) return { error: "Failed to add child." };
  return { state: result.state, childId };
}

export async function markPaymentLinkSentInDb(
  playerId: string,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState((state) => {
    if (!state.players.some((player) => player.id === playerId)) {
      return { error: "Player not found." };
    }
    return markPaymentLinkSent(state, playerId);
  });
}

export async function removePlayerFromProgramInDb(
  playerId: string,
  programId: string,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState((state) =>
    removePlayerFromProgram(state, playerId, programId),
  );
}

/**
 * Paid enrollment — source of truth for Mongo (and memory fallback).
 * Idempotent when already enrolled and paid.
 */
export async function enrollPaidInDb(
  playerId: string,
  programId: string,
  clinicId: string,
  paidAt: string = new Date().toISOString(),
  merchandiseOrder?: import("@/lib/types").Player["merchandiseOrder"],
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState((state) => {
    const player = state.players.find((entry) => entry.id === playerId);
    const alreadyEnrolled =
      Boolean(player?.sessionIds.includes(clinicId)) &&
      Boolean(player?.paymentLinkSentAt);

    if (alreadyEnrolled) {
      if (!merchandiseOrder || player?.merchandiseOrder) {
        return state;
      }
      return updatePlayer(state, playerId, {
        ...player!,
        merchandiseOrder,
      });
    }

    return completePaidClinicRegistration(
      state,
      playerId,
      programId,
      clinicId,
      paidAt,
      merchandiseOrder,
    );
  });
}

export async function claimProcessedPayment(
  paymentIntentId: string,
): Promise<boolean> {
  if (!isMongoConfigured()) {
    const memory = getMemoryDb();
    if (memory.processedPaymentIds.has(paymentIntentId)) return false;
    memory.processedPaymentIds.add(paymentIntentId);
    return true;
  }

  const db = await getDb();
  const result = await db.collection(PROCESSED_PAYMENTS).updateOne(
    { paymentIntentId },
    {
      $setOnInsert: {
        paymentIntentId,
        processedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  );
  return result.upsertedCount === 1;
}
