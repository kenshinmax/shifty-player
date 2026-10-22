import { formatMonth } from "./format";
import { getPlayerPaymentAmount, isPlayerPaid } from "./payment";
import { getClinicCapacity, seatsTaken } from "./programs";
import type { AppState, Player, Session } from "./types";

export type PlayerTrendPoint = {
  year: number;
  month: number;
  label: string;
  players: number;
};

export type ClinicEnrollmentBar = {
  sessionId: string;
  label: string;
  monthLabel: string;
  enrolled: number;
  capacity: number;
};

/**
 * Distinct players enrolled in any clinic per month, for the most recent
 * months that have clinics scheduled (oldest first).
 */
export function buildPlayerTrend(
  players: Player[],
  sessions: Session[],
  maxMonths = 6,
): PlayerTrendPoint[] {
  const sessionMonth = new Map(
    sessions.map((session) => [session.id, session.year * 12 + session.month - 1]),
  );
  const monthKeys = [...new Set(sessionMonth.values())]
    .sort((a, b) => a - b)
    .slice(-maxMonths);

  return monthKeys.map((key) => {
    const year = Math.floor(key / 12);
    const month = (key % 12) + 1;
    const count = players.filter((player) =>
      player.sessionIds.some((id) => sessionMonth.get(id) === key),
    ).length;
    return { year, month, label: formatMonth(month), players: count };
  });
}

/** Enrollment against capacity for each clinic in a program, in calendar order. */
export function buildClinicEnrollment(
  state: Pick<AppState, "players" | "sessions" | "seatCounts">,
  programId: string,
): ClinicEnrollmentBar[] {
  return state.sessions
    .filter((session) => session.programId === programId)
    .sort(
      (a, b) =>
        a.year - b.year || a.month - b.month || (a.week ?? 0) - (b.week ?? 0),
    )
    .map((session) => ({
      sessionId: session.id,
      label:
        session.week !== undefined
          ? `W${session.week}`
          : (session.label ?? formatMonth(session.month)),
      monthLabel: formatMonth(session.month).slice(0, 3),
      enrolled: seatsTaken(state, session.id),
      capacity: getClinicCapacity(session),
    }));
}

/** Revenue from paid players, using the same per-player amount as Financials. */
export function sumPaidRevenue(players: Player[]): number {
  return players
    .filter(isPlayerPaid)
    .reduce((total, player) => total + getPlayerPaymentAmount(player), 0);
}
