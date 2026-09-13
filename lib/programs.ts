import { formatMonth } from "./format";
import {
  DEFAULT_CLINIC_CAPACITY,
  type Player,
  type Program,
  type Session,
} from "./types";

/** Weekly clinic tuition shown on registration payment (Stripe-ready). */
export const CLINIC_WEEKLY_FEE_USD = 460;

/** Resolves clinic capacity, falling back to the default of 50. */
export function getClinicCapacity(clinic: Session): number {
  return clinic.capacity > 0 ? clinic.capacity : DEFAULT_CLINIC_CAPACITY;
}

/** How many player spots remain in a clinic. */
export function getRemainingClinicSpots(
  players: Player[],
  clinic: Session,
): number {
  const enrolled = players.filter((player) =>
    player.sessionIds.includes(clinic.id),
  ).length;
  return Math.max(0, getClinicCapacity(clinic) - enrolled);
}

/** Registration status for a child's active program row. */
export type ActiveProgramStatus = "enrolled" | "pending" | "inactive";

export type ActiveProgramRecord = {
  id: string;
  date: string;
  playerName: string;
  programName: string;
  clinicName: string;
  location: string;
  status: ActiveProgramStatus;
};

/** Programs admins have opened for parent registration. */
export function getOpenPrograms(programs: Program[]): Program[] {
  return [...programs]
    .filter((program) => program.open)
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.startMonth - a.startMonth;
    });
}

/** @deprecated Prefer getOpenPrograms — kept as alias for clarity. */
export const getAvailablePrograms = getOpenPrograms;

/** All clinic weeks belonging to a program, ordered by week then month. */
export function getClinicsForProgram(
  sessions: Session[],
  programId: string,
): Session[] {
  return sessions
    .filter((session) => session.programId === programId)
    .sort((a, b) => {
      if ((a.week ?? 0) !== (b.week ?? 0)) {
        return (a.week ?? 0) - (b.week ?? 0);
      }
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
}

/**
 * Clinics parents can register for: must belong to the program, be marked
 * available by an administrator, and have remaining player spots.
 */
export function getAvailableClinicsForProgram(
  sessions: Session[],
  programId: string,
  players: Player[] = [],
): Session[] {
  return getClinicsForProgram(sessions, programId).filter(
    (session) =>
      session.available && getRemainingClinicSpots(players, session) > 0,
  );
}

export function formatProgramTimeframe(program: Program): string {
  if (program.startDate && program.endDate) {
    const start = formatIsoDate(program.startDate);
    const end = formatIsoDate(program.endDate);
    if (start && end) return `${start} – ${end}`;
  }
  if (program.startMonth === program.endMonth) {
    return `${formatMonth(program.startMonth)} ${program.year}`;
  }
  return `${formatMonth(program.startMonth)} – ${formatMonth(program.endMonth)} ${program.year}`;
}

function formatIsoDate(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${formatMonth(month)} ${day}, ${match[1]}`;
}

export function getProgramSpots(program: Program): number {
  return program.spots && program.spots > 0
    ? program.spots
    : DEFAULT_CLINIC_CAPACITY;
}

/** Players registered for a program (by programIds or clinic enrollment). */
export function getPlayersForProgram(
  players: Player[],
  sessions: Session[],
  programId: string,
): Player[] {
  const clinicIds = new Set(
    sessions
      .filter((session) => session.programId === programId)
      .map((session) => session.id),
  );
  return players
    .filter(
      (player) =>
        player.programIds.includes(programId) ||
        player.sessionIds.some((sessionId) => clinicIds.has(sessionId)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function formatClinicLabel(clinic: Session): string {
  if (clinic.label) {
    return `${clinic.label} (${formatMonth(clinic.month)} ${clinic.year})`;
  }
  return `${formatMonth(clinic.month)} ${clinic.year}`;
}

export function getActiveProgramStatus(
  player: Player,
  program: Program,
): ActiveProgramStatus {
  if (!program.open || program.status === "completed") {
    return "inactive";
  }
  if (player.paymentLinkSentAt) {
    return "enrolled";
  }
  return "pending";
}

/**
 * Non-completed programs the player is registered for, with clinic and status.
 * One row per enrolled clinic within each active program.
 */
export function getActiveProgramsForPlayer(
  player: Player,
  programs: Program[],
  sessions: Session[],
): ActiveProgramRecord[] {
  return player.programIds
    .map((programId) => programs.find((program) => program.id === programId))
    .filter((program): program is Program => Boolean(program))
    .filter((program) => program.status !== "completed")
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.startMonth - a.startMonth;
    })
    .flatMap((program) => {
      const clinics = sessions
        .filter(
          (session) =>
            session.programId === program.id &&
            player.sessionIds.includes(session.id),
        )
        .sort((a, b) => {
          if ((a.week ?? 0) !== (b.week ?? 0)) {
            return (a.week ?? 0) - (b.week ?? 0);
          }
          return a.month - b.month;
        });

      const status = getActiveProgramStatus(player, program);
      const base = {
        date: formatProgramTimeframe(program),
        playerName: player.name,
        programName: program.name,
        location: program.location?.trim() || "TBD",
        status,
      };

      if (clinics.length === 0) {
        return [
          {
            ...base,
            id: `${player.id}:${program.id}`,
            clinicName: "—",
          },
        ];
      }

      return clinics.map((clinic) => ({
        ...base,
        id: `${player.id}:${program.id}:${clinic.id}`,
        clinicName: formatClinicLabel(clinic),
      }));
    });
}

/** Active programs across multiple children, newest first. */
export function getActiveProgramsForPlayers(
  players: Player[],
  programs: Program[],
  sessions: Session[],
): ActiveProgramRecord[] {
  return players
    .flatMap((player) =>
      getActiveProgramsForPlayer(player, programs, sessions),
    )
    .sort((a, b) => a.playerName.localeCompare(b.playerName));
}
