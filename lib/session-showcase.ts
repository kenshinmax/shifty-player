import type { Session } from "./types";

/** Sort sessions newest-first by year, then month. */
export function sortSessionsByRecent(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

/** Newest session, if any exist. */
export function getLatestSession(sessions: Session[]): Session | undefined {
  return sortSessionsByRecent(sessions)[0];
}

/** All sessions after the latest, newest-first. */
export function getMoreSessions(sessions: Session[]): Session[] {
  return sortSessionsByRecent(sessions).slice(1);
}
