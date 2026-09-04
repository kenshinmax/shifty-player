import { sortSessionsByRecent } from "./session-showcase";
import type { Session } from "./types";

/** Clinics open for registration (upcoming or in progress). */
export function getAvailableClinics(sessions: Session[]): Session[] {
  return sortSessionsByRecent(
    sessions.filter(
      (session) =>
        session.status === "trending" || session.status === "in-progress",
    ),
  );
}
