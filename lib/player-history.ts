import type { Level } from "./types";

export type CompletedSeasonRecord = {
  id: string;
  date: string;
  seasonLabel: string;
  grade: string;
  level: Level;
  gamesPlayed: number;
};

/** Demo completed-season history keyed by signed-in user id. */
export const PLAYER_COMPLETED_SEASONS: Record<string, CompletedSeasonRecord[]> =
  {
    "user-1": [
      {
        id: "history-1",
        date: "2025-07",
        seasonLabel: "July Camp",
        grade: "6",
        level: "beginner",
        gamesPlayed: 8,
      },
      {
        id: "history-2",
        date: "2025-08",
        seasonLabel: "Summer Wrap",
        grade: "6",
        level: "beginner",
        gamesPlayed: 10,
      },
      {
        id: "history-3",
        date: "2025-09",
        seasonLabel: "Back to School",
        grade: "7",
        level: "intermediate",
        gamesPlayed: 12,
      },
      {
        id: "history-4",
        date: "2025-10",
        seasonLabel: "October Skills",
        grade: "7",
        level: "intermediate",
        gamesPlayed: 14,
      },
      {
        id: "history-5",
        date: "2025-11",
        seasonLabel: "Fall Classic",
        grade: "7",
        level: "intermediate",
        gamesPlayed: 16,
      },
    ],
  };

export function getCompletedSeasonsForUser(
  userId: string,
): CompletedSeasonRecord[] {
  return PLAYER_COMPLETED_SEASONS[userId] ?? [];
}

export function formatSeasonDate(date: string): string {
  const [year, month] = date.split("-").map(Number);
  if (!year || !month) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}
