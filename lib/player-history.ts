import type { Level } from "./types";

export type CompletedProgramRecord = {
  id: string;
  date: string;
  programLabel: string;
  grade: string;
  level: Level;
  gamesPlayed: number;
};

/** Demo completed-program history keyed by child player id. */
export const PLAYER_COMPLETED_PROGRAMS: Record<
  string,
  CompletedProgramRecord[]
> = {
  "player-child-1": [
    {
      id: "history-maya-1",
      date: "2025-07",
      programLabel: "July Camp",
      grade: "4",
      level: "beginner",
      gamesPlayed: 8,
    },
    {
      id: "history-maya-2",
      date: "2025-08",
      programLabel: "Summer Wrap",
      grade: "4",
      level: "beginner",
      gamesPlayed: 10,
    },
  ],
  "player-child-2": [
    {
      id: "history-lucas-1",
      date: "2025-09",
      programLabel: "Back to School",
      grade: "6",
      level: "intermediate",
      gamesPlayed: 12,
    },
    {
      id: "history-lucas-2",
      date: "2025-10",
      programLabel: "October Skills",
      grade: "6",
      level: "intermediate",
      gamesPlayed: 14,
    },
    {
      id: "history-lucas-3",
      date: "2025-11",
      programLabel: "Fall Classic",
      grade: "7",
      level: "intermediate",
      gamesPlayed: 16,
    },
  ],
};

export function getCompletedProgramsForUser(
  userId: string,
): CompletedProgramRecord[] {
  return PLAYER_COMPLETED_PROGRAMS[userId] ?? [];
}

export function formatProgramDate(date: string): string {
  const [year, month] = date.split("-").map(Number);
  if (!year || !month) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}
