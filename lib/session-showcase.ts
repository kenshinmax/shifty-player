import type { Session } from "./types";

/** Sort sessions newest-first by year, then month, then week. */
export function sortSessionsByRecent(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if (a.month !== b.month) return b.month - a.month;
    return (b.week ?? 0) - (a.week ?? 0);
  });
}

/** Prefer a program's first clinic (week 1 or single clinic without a week). */
function isPrimaryClinic(session: Session): boolean {
  return session.week === undefined || session.week === 1;
}

/** Newest primary clinic, used to feature a program on the programs page. */
export function getLatestSession(sessions: Session[]): Session | undefined {
  const primaries = sessions.filter(isPrimaryClinic);
  return sortSessionsByRecent(primaries.length > 0 ? primaries : sessions)[0];
}

/** Remaining clinics after the featured primary, newest-first. */
export function getMoreSessions(sessions: Session[]): Session[] {
  const featured = getLatestSession(sessions);
  if (!featured) return sortSessionsByRecent(sessions);
  return sortSessionsByRecent(
    sessions.filter((session) => session.id !== featured.id),
  );
}
