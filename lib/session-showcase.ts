import type { Session } from "./types";

/** Sort sessions newest-first by year, then month. */
export function sortSessionsByRecent(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

export type SessionShowcaseSlices = {
  featured: Session | undefined;
  cards: Session[];
  table: Session[];
};

/** Top 1 megatron + next 2 cards + next 4 table rows. */
export function sliceSessionsForShowcase(
  sessions: Session[],
): SessionShowcaseSlices {
  const sorted = sortSessionsByRecent(sessions);
  return {
    featured: sorted[0],
    cards: sorted.slice(1, 3),
    table: sorted.slice(3, 7),
  };
}
