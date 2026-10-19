export type Level = "beginner" | "intermediate" | "advanced";

export type SessionStatus = "trending" | "in-progress" | "completed";

/** A program parents register children for (e.g. Summer Camp 2026). */
export type Program = {
  id: string;
  name: string;
  /** Short summary shown to admins and on program detail. */
  description?: string;
  year: number;
  status: SessionStatus;
  /** Admin-controlled: when true, parents can register for this program. */
  open: boolean;
  /** Inclusive start month (1–12). */
  startMonth: number;
  /** Inclusive end month (1–12). */
  endMonth: number;
  /** ISO date (YYYY-MM-DD) when the program begins. */
  startDate?: string;
  /** ISO date (YYYY-MM-DD) when the program ends. */
  endDate?: string;
  location?: string;
  /** Default / overall player spots for clinics in this program. */
  spots?: number;
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
  /** Max player spots for this clinic. */
  capacity: number;
  /** Clinic tuition in USD. Falls back to CLINIC_WEEKLY_FEE_USD when unset. */
  priceUsd?: number;
};

/** Default clinic player capacity when not specified. */
export const DEFAULT_CLINIC_CAPACITY = 50;

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
  /** Optional team gear purchased with the latest paid clinic enrollment. */
  merchandiseOrder?: {
    clinicId: string;
    items: {
      skuId: string;
      name: string;
      size: string;
      quantity: number;
      unitCents: number;
    }[];
    tuitionCents: number;
    swagCents: number;
    totalCents: number;
    paidAt: string;
  };
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

export type OrganizationStatus = "draft" | "pending_review" | "live" | "suspended";

export type Organization = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
  status: OrganizationStatus;
  stripeAccountId?: string;
  stripeChargesEnabled: boolean;
  platformFeeBps: number;
  hubspotEnabled: boolean;
  createdAt: string;
  approvedAt?: string;
};

export type OrgProgram = Program & { orgId: string };
export type OrgSession = Session & { orgId: string };

/** A parent's child (or an org-added roster player). Not owned by an org. */
export type Child = {
  id: string;
  parentUserId?: string;
  createdByOrgId?: string;
  name: string;
  email: string;
  grade: string;
  level: Level;
  avatarUrl?: string;
};

export type EnrollmentStatus = "pending" | "paid" | "removed";

export type Enrollment = {
  id: string;
  orgId: string;
  childId: string;
  programId: string;
  sessionId: string;
  status: EnrollmentStatus;
  paidAt?: string;
  stripePaymentIntentId?: string;
  paymentLinkSentAt?: string;
  createdAt: string;
};

export type OrderItem = NonNullable<Player["merchandiseOrder"]>["items"][number];

export type Order = {
  id: string;
  orgId: string;
  parentUserId?: string;
  childId: string;
  sessionId: string;
  items: OrderItem[];
  tuitionCents: number;
  swagCents: number;
  totalCents: number;
  platformFeeCents: number;
  stripePaymentIntentId?: string;
  paidAt: string;
};
