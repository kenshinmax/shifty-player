import { getDocStore, resetMemoryStore } from "@/lib/db/doc-store";
import {
  assembleLegacyState,
  enrollmentId,
  splitLegacyState,
  type OrgDocuments,
} from "@/lib/db/legacy-state";
import { diffOrgDocuments, isEmptyWriteOps } from "@/lib/db/org-diff";
import { forOrg, visibleChildIds } from "@/lib/db/org-repository";
import { ensureDefaultOrganization } from "@/lib/db/platform-repository";
import { DEFAULT_ORG_ID, defaultOrganization } from "@/lib/organizations";
import { buildSeatCounts } from "@/lib/programs";
import { normalizeRegistrationState } from "@/lib/storage";
import { sampleData } from "@/lib/sample-data";
import type { AppState, Child, Enrollment, Organization, Session } from "@/lib/types";
import {
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
  type PlayerInput,
  type ProgramInput,
  type SessionInput,
  validatePlayerInput,
  validateProgramInput,
  validateSessionInput,
} from "@/lib/player-store";

export type Viewer =
  | { kind: "admin" }
  | { kind: "parent"; userId: string }
  | { kind: "public" };

export const ORG_NOT_FOUND = "Organization not found.";

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

/** The default org is created on demand; any other org must already exist. */
async function ensureOrganization(orgId: string): Promise<void> {
  if (orgId === DEFAULT_ORG_ID) {
    await ensureDefaultOrganization();
    return;
  }
  const org = await getDocStore().findOne<Organization>("organizations", { id: orgId });
  if (!org) throw new Error(ORG_NOT_FOUND);
}

/**
 * Org docs plus every child. Mutations need children that are not yet on the
 * roster (a parent's child registering here for the first time); viewers only
 * ever get a filtered copy through getStateForViewer.
 */
async function readDocuments(orgId: string): Promise<OrgDocuments> {
  const store = getDocStore();
  const unstamped = { orgId: { $exists: false } };
  const [players, programs, sessions] = await Promise.all([
    store.count("players"),
    store.count("programs", unstamped),
    store.count("sessions", unstamped),
  ]);
  if (players > 0 || programs > 0 || sessions > 0) {
    throw new Error(LEGACY_DATA_ERROR);
  }
  await ensureOrganization(orgId);
  const [orgDocs, children] = await Promise.all([
    forOrg(orgId, store).loadOrgDocuments(),
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

async function writeState(
  orgId: string,
  before: OrgDocuments,
  state: AppState,
): Promise<void> {
  const normalized = normalizeRegistrationState(state);
  const after = keepChildOwnership(
    before,
    splitLegacyState(normalized, orgId, before),
  );
  const ops = diffOrgDocuments(before, after);
  if (isEmptyWriteOps(ops)) return;
  await forOrg(orgId, getDocStore()).applyWrites(ops);
}

async function loadDocuments(orgId: string): Promise<OrgDocuments> {
  const docs = await readDocuments(orgId);
  if (
    orgId === DEFAULT_ORG_ID &&
    docs.programs.length === 0 &&
    docs.sessions.length === 0 &&
    docs.children.length === 0
  ) {
    await writeState(orgId, docs, structuredClone(sampleData) as AppState);
    return readDocuments(orgId);
  }
  return docs;
}

/** What a mutator may need beyond the legacy state. */
type MutationContext = {
  /** Children this org may read (spec visibility rule). */
  visible: Set<string>;
  /** Stored child docs by id, including ownership fields the legacy shape drops. */
  children: Map<string, Child>;
};

function contextFor(orgId: string, docs: OrgDocuments): MutationContext {
  return {
    visible: visibleChildIds(orgId, docs.children, docs.enrollments),
    children: new Map(docs.children.map((child) => [child.id, child])),
  };
}

async function mutateAppState(
  orgId: string,
  mutator: (state: AppState, context: MutationContext) => AppState | { error: string },
  afterWrite?: () => Promise<void>,
): Promise<{ state: AppState } | { error: string }> {
  return enqueueRegistrationWrite(async () => {
    const before = await loadDocuments(orgId);
    const result = mutator(assembleLegacyState(before), contextFor(orgId, before));
    if ("error" in result) return { error: result.error };
    await writeState(orgId, before, result);
    // Runs inside the write queue so no concurrent mutation sees a stale doc.
    await afterWrite?.();
    return { state: assembleLegacyState(await loadDocuments(orgId)) };
  });
}

/** Full internal state for server use (webhooks, HubSpot). Never send to clients. */
export async function getRegistrationState(orgId: string): Promise<AppState> {
  return assembleLegacyState(await loadDocuments(orgId));
}

/** Client-safe state: programs, sessions, seatCounts (always), players per viewer. */
export async function getStateForViewer(
  orgId: string,
  viewer: Viewer,
): Promise<AppState> {
  const docs = await loadDocuments(orgId);
  const state = assembleLegacyState(docs);
  const seatCounts = buildSeatCounts(state.players);
  let players: AppState["players"];
  if (viewer.kind === "admin") {
    const visible = visibleChildIds(orgId, docs.children, docs.enrollments);
    players = state.players.filter((player) => visible.has(player.id));
  } else if (viewer.kind === "parent") {
    players = state.players.filter(
      (player) => player.parentUserId === viewer.userId,
    );
  } else {
    players = [];
  }
  return { ...state, players, seatCounts };
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
  orgId: string,
  input: ProgramInput,
): Promise<{ state: AppState; programId: string } | { error: string }> {
  const validationError = validateProgramInput(input);
  if (validationError) return { error: validationError };

  let programId: string | null = null;
  const result = await mutateAppState(orgId, (state) => {
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
  orgId: string,
  programId: string,
  open: boolean,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState(orgId, (state) => {
    if (!state.programs.some((program) => program.id === programId)) {
      return { error: "Program not found." };
    }
    return setProgramOpen(state, programId, open);
  });
}

export async function updateProgramInDb(
  orgId: string,
  programId: string,
  input: ProgramInput,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState(orgId, (state) => updateProgram(state, programId, input));
}

/** Program ids in a body must belong to this org's state. */
function hasProgram(state: AppState, programId: string): boolean {
  return state.programs.some((program) => program.id === programId);
}

export async function createClinicInDb(
  orgId: string,
  input: SessionInput,
): Promise<{ state: AppState } | { error: string }> {
  const validationError = validateSessionInput(input);
  if (validationError) return { error: validationError };

  return mutateAppState(orgId, (state) => {
    if (input.programId && !hasProgram(state, input.programId)) {
      return { error: "Program not found." };
    }
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
  orgId: string,
  clinicId: string,
  input: SessionInput,
): Promise<{ state: AppState } | { error: string }> {
  const validationError = validateSessionInput(input);
  if (validationError) return { error: validationError };

  return mutateAppState(orgId, (state) => {
    const existing = state.sessions.find((session) => session.id === clinicId);
    if (!existing) return { error: "Clinic not found." };
    if (input.programId && !hasProgram(state, input.programId)) {
      return { error: "Program not found." };
    }
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
  orgId: string,
  clinicId: string,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState(orgId, (state) => {
    if (!state.sessions.some((session) => session.id === clinicId)) {
      return { error: "Clinic not found." };
    }
    return deleteSession(state, clinicId);
  });
}

export async function setClinicAvailableInDb(
  orgId: string,
  clinicId: string,
  available: boolean,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState(orgId, (state) => {
    if (!state.sessions.some((session) => session.id === clinicId)) {
      return { error: "Clinic not found." };
    }
    return setClinicAvailable(state, clinicId, available);
  });
}

export async function createPlayerInDb(
  orgId: string,
  input: PlayerInput,
): Promise<{ state: AppState } | { error: string }> {
  const validationError = validatePlayerInput(input);
  if (validationError) return { error: validationError };

  return mutateAppState(orgId, (state) =>
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
  orgId: string,
  playerId: string,
  input: PlayerInput,
): Promise<{ state: AppState } | { error: string }> {
  const validationError = validatePlayerInput(input);
  if (validationError) return { error: validationError };

  return mutateAppState(orgId, (state, { visible }) => {
    const existing = state.players.find((player) => player.id === playerId);
    if (!existing || !visible.has(playerId)) return { error: "Player not found." };
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
  orgId: string,
  playerId: string,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState(orgId, (state, { visible, children }) => {
    const child = children.get(playerId);
    if (!child || !visible.has(playerId)) return { error: "Player not found." };
    if (!child.parentUserId && child.createdByOrgId === orgId) {
      return deletePlayer(state, playerId);
    }
    // The child belongs to a parent (or another org): drop only this org's
    // registrations and keep the child.
    return {
      ...state,
      players: state.players.map((player) =>
        player.id === playerId
          ? { ...player, programIds: [], sessionIds: [] }
          : player,
      ),
    };
  });
}

export async function markPaymentLinkSentInDb(
  orgId: string,
  playerId: string,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState(orgId, (state, { visible }) => {
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player || !visible.has(playerId)) return { error: "Player not found." };
    return markPaymentLinkSent(state, playerId);
  });
}

export async function removePlayerFromProgramInDb(
  orgId: string,
  playerId: string,
  programId: string,
): Promise<{ state: AppState } | { error: string }> {
  return mutateAppState(orgId, (state, { visible }) => {
    if (!state.programs.some((program) => program.id === programId)) {
      return { error: "Program not found." };
    }
    if (!visible.has(playerId)) return { error: "Player not found." };
    return removePlayerFromProgram(state, playerId, programId);
  });
}

/**
 * Paid enrollment — source of truth for Mongo (and memory fallback).
 * Idempotent when already enrolled and paid.
 */
export async function enrollPaidInDb(
  orgId: string,
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
      orgId,
      id,
    });
    if (enrollment && enrollment.status !== "paid") {
      await forOrg(orgId, getDocStore()).markEnrollmentPaid(id, paidAt);
    }
  };

  return mutateAppState(orgId, (state, { visible, children }) => {
    // Claimable: already on this org's roster, or a parent's child registering
    // here for the first time. Never another org's own child.
    const child = children.get(playerId);
    if (child && !visible.has(playerId) && !child.parentUserId) {
      return { error: "Player not found." };
    }
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
