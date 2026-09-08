export type Level = "beginner" | "intermediate" | "advanced";

export type SessionStatus = "trending" | "in-progress" | "completed";

/** A program parents register children for (e.g. Summer Camp 2026). */
export type Program = {
  id: string;
  name: string;
  year: number;
  status: SessionStatus;
  /** Admin-controlled: when true, parents can register for this program. */
  open: boolean;
  /** Inclusive start month (1–12). */
  startMonth: number;
  /** Inclusive end month (1–12). */
  endMonth: number;
  location?: string;
};

/**
 * A clinic week belonging to a program.
 * Example: Summer Camp 2026 has six weekly clinics from July–August.
 */
export type Session = {
  id: string;
  programId: string;
  year: number;
  month: number;
  /** Clinic week number within the program (optional for single-clinic programs). */
  week?: number;
  label?: string;
  status: SessionStatus;
  /** Admin-controlled: when true, clinic is available within an open program. */
  available: boolean;
};

export type Player = {
  id: string;
  name: string;
  email: string;
  grade: string;
  level: Level;
  /** Programs this player is registered for. */
  programIds: string[];
  /** Clinic sessions enrolled in (usually all clinics under registered programs). */
  sessionIds: string[];
  /** Parent account that manages this player (demo parents register children). */
  parentUserId?: string;
  paymentLinkSentAt?: string;
  /** Optional profile photo URL for roster cards. */
  avatarUrl?: string;
};

export type AppState = {
  programs: Program[];
  sessions: Session[];
  players: Player[];
};

export const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

export const SESSION_STATUSES: SessionStatus[] = [
  "trending",
  "in-progress",
  "completed",
];

export function formatSessionStatus(status: SessionStatus): string {
  switch (status) {
    case "trending":
      return "Trending";
    case "in-progress":
      return "In-progress";
    case "completed":
      return "Completed";
  }
}
