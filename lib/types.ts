export type Level = "beginner" | "intermediate" | "advanced";

export type SessionStatus = "trending" | "in-progress" | "completed";

export type Session = {
  id: string;
  year: number;
  month: number;
  label?: string;
  status: SessionStatus;
};

export type Player = {
  id: string;
  name: string;
  email: string;
  grade: string;
  level: Level;
  sessionIds: string[];
  /** Parent account that manages this player (demo parents register children). */
  parentUserId?: string;
  paymentLinkSentAt?: string;
  /** Optional profile photo URL for roster cards. */
  avatarUrl?: string;
};

export type AppState = {
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
