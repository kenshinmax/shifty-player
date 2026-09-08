import { formatMonth } from "./format";
import type { Player, Program, Session } from "./types";

/** Registration status for a child's active program row. */
export type ActiveProgramStatus = "enrolled" | "pending" | "inactive";

export type ActiveProgramRecord = {
  id: string;
  date: string;
  playerName: string;
  programName: string;
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
 * Clinics parents can register for: must belong to the program and be marked
 * available by an administrator.
 */
export function getAvailableClinicsForProgram(
  sessions: Session[],
  programId: string,
): Session[] {
  return getClinicsForProgram(sessions, programId).filter(
    (session) => session.available,
  );
}

export function formatProgramTimeframe(program: Program): string {
  if (program.startMonth === program.endMonth) {
    return `${formatMonth(program.startMonth)} ${program.year}`;
  }
  return `${formatMonth(program.startMonth)} – ${formatMonth(program.endMonth)} ${program.year}`;
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
 * Non-completed programs the player is registered for, with enrollment status.
 */
export function getActiveProgramsForPlayer(
  player: Player,
  programs: Program[],
): ActiveProgramRecord[] {
  return player.programIds
    .map((programId) => programs.find((program) => program.id === programId))
    .filter((program): program is Program => Boolean(program))
    .filter((program) => program.status !== "completed")
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.startMonth - a.startMonth;
    })
    .map((program) => ({
      id: `${player.id}:${program.id}`,
      date: formatProgramTimeframe(program),
      playerName: player.name,
      programName: program.name,
      location: program.location?.trim() || "TBD",
      status: getActiveProgramStatus(player, program),
    }));
}

/** Active programs across multiple children, newest first. */
export function getActiveProgramsForPlayers(
  players: Player[],
  programs: Program[],
): ActiveProgramRecord[] {
  return players
    .flatMap((player) => getActiveProgramsForPlayer(player, programs))
    .sort((a, b) => a.playerName.localeCompare(b.playerName));
}
