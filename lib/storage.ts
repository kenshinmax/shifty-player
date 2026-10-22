import { DEFAULT_CLINIC_CAPACITY, type AppState, type Session } from "./types";

function normalizeSession(session: Session): Session {
  return {
    ...session,
    capacity:
      typeof session.capacity === "number" && session.capacity > 0
        ? session.capacity
        : DEFAULT_CLINIC_CAPACITY,
    priceUsd:
      typeof session.priceUsd === "number" && session.priceUsd > 0
        ? session.priceUsd
        : undefined,
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export function normalizeRegistrationState(state: AppState): AppState {
  return {
    ...state,
    programs: dedupeById(state.programs).map((program) => ({
      ...program,
      spots:
        typeof program.spots === "number" && program.spots > 0
          ? program.spots
          : DEFAULT_CLINIC_CAPACITY,
    })),
    sessions: dedupeById(state.sessions).map(normalizeSession),
    players: dedupeById(state.players).map((player) => ({
      ...player,
      programIds: dedupeStrings(player.programIds ?? []),
      sessionIds: dedupeStrings(player.sessionIds ?? []),
    })),
  };
}
