import { getDocStore, resetMemoryStore } from "@/lib/db/doc-store";
import {
  assembleLegacyState,
  enrollmentId,
  splitLegacyState,
  type OrgDocuments,
} from "@/lib/db/legacy-state";
import { diffOrgDocuments, isEmptyWriteOps } from "@/lib/db/org-diff";
import { forOrg } from "@/lib/db/org-repository";
import { DEFAULT_ORG_ID, defaultOrganization } from "@/lib/organizations";
import { normalizeRegistrationState } from "@/lib/storage";
import { sampleData } from "@/lib/sample-data";
import type { AppState, Child, Enrollment, Session } from "@/lib/types";
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
  updateProgram,
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

export const LEGACY_DATA_ERROR =
  "Legacy registration data found. Run `npm run migrate:orgs` before starting the app.";

const EMPTY: OrgDocuments = {
  programs: [],
  sessions: [],
  children: [],
  enrollments: [],
  orders: [],
};

/** Reset in-memory registration DB (tests / seed). Synchronous. */
export function resetMemoryRegistrationDb(state: AppState = sampleData): void {
  const normalized = normalizeRegistrationState(structuredClone(state) as AppState);
  resetMemoryStore({
    organizations: [defaultOrganization()],
    ...splitLegacyState(normalized, DEFAULT_ORG_ID),
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

/** Serialize registration writes so concurrent mutations cannot duplicate docs. */
type WriteGlobal = typeof globalThis & {
  __shiftyRegistrationWriteChain?: Promise<unknown>;
};

function enqueueRegistrationWrite<T>(task: () => Promise<T>): Promise<T> {
  const g = globalThis as WriteGlobal;
  const previous = g.__shiftyRegistrationWriteChain ?? Promise.resolve();
  const next = previous.then(task, task);
  g.__shiftyRegistrationWriteChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function ensureDefaultOrganization(): Promise<void> {
  // false means it already exists, which is fine.
  await getDocStore().insertOne("organizations", defaultOrganization());
}

async function readDocuments(): Promise<OrgDocuments> {
  const store = getDocStore();
  if ((await store.count("players")) > 0) {
    throw new Error(LEGACY_DATA_ERROR);
  }
  await ensureDefaultOrganization();
  // Phase 1: every child is visible, because the parent and admin UIs still
  // read one global state. Phase 2 replaces this with roster().
  const [orgDocs, children] = await Promise.all([
    forOrg(DEFAULT_ORG_ID, store).loadOrgDocuments(),
    store.find<Child>("children"),
  ]);
  return { ...orgDocs, children };
}

/**
 * The legacy shape has no createdByOrgId, so splitLegacyState re-derives it.
 * Keep the stored value for existing children so an unrelated mutation never
 * rewrites a child that another organization created.
 */
function keepChildOwnership(before: OrgDocuments, after: OrgDocuments): OrgDocuments {
  const prior = new Map(before.children.map((child) => [child.id, child]));
  return {
    ...after,
    children: after.children.map((child) => {
      const existing = prior.get(child.id);
      if (!existing) return child;
      const kept: Child = { ...child };
      delete kept.createdByOrgId;
      if (existing.createdByOrgId !== undefined) {
        kept.createdByOrgId = existing.createdByOrgId;
      }
      return kept;
    }),
  };
}

async function writeState(before: OrgDocuments, state: AppState): Promise<void> {
  const normalized = normalizeRegistrationState(state);
  const after = keepChildOwnership(
    before,
    splitLegacyState(normalized, DEFAULT_ORG_ID, before),
  );
  const ops = diffOrgDocuments(before, after);
  if (isEmptyWriteOps(ops)) return;
  await forOrg(DEFAULT_ORG_ID, getDocStore()).applyWrites(ops);
}

async function loadDocuments(): Promise<OrgDocuments> {
  const docs = await readDocuments();
  if (
    docs.programs.length === 0 &&
    docs.sessions.length === 0 &&
    docs.children.length === 0
  ) {
    await writeState(docs, structuredClone(sampleData) as AppState);
    return readDocuments();
  }
  return docs;
}

async function mutateAppState(
  mutator: (state: AppState) => AppState | { error: string },
  afterWrite?: () => Promise<void>,
): Promise<{ state: AppState } | { error: string }> {
  return enqueueRegistrationWrite(async () => {
    const before = await loadDocuments();
    const result = mutator(assembleLegacyState(before));
    if ("error" in result) return { error: result.error };
    await writeState(before, result);
    // Runs inside the write queue so no concurrent mutation sees a stale doc.
    await afterWrite?.();
    return { state: assembleLegacyState(await loadDocuments()) };
  });
}

export async function getRegistrationState(): Promise<AppState> {
  return assembleLegacyState(await loadDocuments());
}

export async function seedRegistrationState(
  state: AppState = sampleData,
): Promise<AppState> {
  return enqueueRegistrationWrite(async () => {
    const next = normalizeRegistrationState(structuredClone(state) as AppState);
    const store = getDocStore();
    await forOrg(DEFAULT_ORG_ID, store).clearOrgDocuments();
    await store.deleteMany("children");
    // Clear processed payments on full seed so e2e is deterministic.
    await store.deleteMany("processed_payments");
    await ensureDefaultOrganization();
    await forOrg(DEFAULT_ORG_ID, store).applyWrites(
      diffOrgDocuments(EMPTY, splitLegacyState(next, DEFAULT_ORG_ID)),
    );
    return next;
  });
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

export async function updateProgramInDb(
  programId: string,
  input: ProgramInput,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState((state) => updateProgram(state, programId, input));
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
      capacity: input.capacity,
      priceUsd: input.priceUsd,
      available: input.available,
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
      capacity: input.capacity,
      priceUsd: input.priceUsd,
      available: input.available,
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
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) return { error: "Player not found." };
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
  // Tuition-only payments leave no order behind, so the diff alone cannot mark
  // the enrollment paid; record it directly once the registration is written.
  const markPaid = async () => {
    const id = enrollmentId(playerId, clinicId);
    const enrollment = await getDocStore().findOne<Enrollment>("enrollments", {
      orgId: DEFAULT_ORG_ID,
      id,
    });
    if (enrollment && enrollment.status !== "paid") {
      await forOrg(DEFAULT_ORG_ID, getDocStore()).markEnrollmentPaid(id, paidAt);
    }
  };

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
  }, markPaid);
}

export async function claimProcessedPayment(
  paymentIntentId: string,
): Promise<boolean> {
  return getDocStore().insertOne("processed_payments", {
    paymentIntentId,
    processedAt: new Date().toISOString(),
  });
}
