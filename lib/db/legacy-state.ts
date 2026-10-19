import { normalizeRegistrationState } from "@/lib/storage";
import type {
  AppState,
  Child,
  Enrollment,
  Order,
  OrgProgram,
  OrgSession,
  Player,
} from "@/lib/types";

export type OrgDocuments = {
  programs: OrgProgram[];
  sessions: OrgSession[];
  children: Child[];
  /** Active (non-removed) enrollments only. */
  enrollments: Enrollment[];
  orders: Order[];
};

export function enrollmentId(childId: string, sessionId: string): string {
  return `enr-${childId}-${sessionId}`;
}

function orderId(childId: string, sessionId: string, paidAt: string): string {
  return `ord-${childId}-${sessionId}-${Date.parse(paidAt)}`;
}

/** Drops keys whose value is undefined so deep-equality round-trips. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}

/** A shallow copy of `doc` without `key`. */
function without<T extends object, K extends keyof T>(doc: T, key: K): Omit<T, K> {
  const copy: Partial<T> = { ...doc };
  delete copy[key];
  return copy as Omit<T, K>;
}

export function splitLegacyState(
  state: AppState,
  orgId: string,
  existing?: OrgDocuments,
  now: string = new Date().toISOString(),
): OrgDocuments {
  const programs: OrgProgram[] = state.programs.map((p) => ({ ...p, orgId }));
  const sessions: OrgSession[] = state.sessions.map((s) => ({ ...s, orgId }));
  const sessionById = new Map(state.sessions.map((s) => [s.id, s]));
  const existingEnrollments = new Map(
    (existing?.enrollments ?? []).map((e) => [e.id, e]),
  );
  const existingOrderIds = new Set((existing?.orders ?? []).map((o) => o.id));

  const children: Child[] = [];
  const enrollments: Enrollment[] = [];
  const derivedOrders: Order[] = [];

  for (const player of state.players) {
    children.push(
      compact({
        id: player.id,
        parentUserId: player.parentUserId,
        createdByOrgId: player.parentUserId ? undefined : orgId,
        name: player.name,
        email: player.email,
        grade: player.grade,
        level: player.level,
        avatarUrl: player.avatarUrl,
        paymentLinkSentAt: player.paymentLinkSentAt,
      }),
    );

    const order = player.merchandiseOrder;
    for (const sessionId of player.sessionIds) {
      const session = sessionById.get(sessionId);
      if (!session) continue;
      const id = enrollmentId(player.id, sessionId);
      const prior = existingEnrollments.get(id);
      const paidNow = order?.clinicId === sessionId;
      enrollments.push(
        compact<Enrollment>({
          id,
          orgId,
          childId: player.id,
          programId: session.programId,
          sessionId,
          status: prior ? prior.status : paidNow ? "paid" : "pending",
          paidAt: prior ? prior.paidAt : paidNow ? order.paidAt : undefined,
          stripePaymentIntentId: prior?.stripePaymentIntentId,
          paymentLinkSentAt: player.paymentLinkSentAt,
          createdAt: prior ? prior.createdAt : now,
        }),
      );
    }

    if (order) {
      const id = orderId(player.id, order.clinicId, order.paidAt);
      if (!existingOrderIds.has(id)) {
        derivedOrders.push(
          compact<Order>({
            id,
            orgId,
            parentUserId: player.parentUserId,
            childId: player.id,
            sessionId: order.clinicId,
            items: order.items,
            tuitionCents: order.tuitionCents,
            swagCents: order.swagCents,
            totalCents: order.totalCents,
            platformFeeCents: 0,
            paidAt: order.paidAt,
          }),
        );
      }
    }
  }

  return {
    programs,
    sessions,
    children,
    enrollments,
    orders: [...(existing?.orders ?? []), ...derivedOrders],
  };
}

export function assembleLegacyState(docs: OrgDocuments): AppState {
  const players: Player[] = docs.children.map((child) => {
    const mine = docs.enrollments.filter((e) => e.childId === child.id);
    const programIds = [...new Set(mine.map((e) => e.programId))];
    const sent = [child.paymentLinkSentAt, ...mine.map((e) => e.paymentLinkSentAt)]
      .filter((v): v is string => Boolean(v))
      .sort();
    const latest = docs.orders
      .filter((o) => o.childId === child.id)
      .reduce<Order | undefined>(
        (best, o) => (!best || Date.parse(o.paidAt) > Date.parse(best.paidAt) ? o : best),
        undefined,
      );
    return compact<Player>({
      ...without(child, "createdByOrgId"),
      programIds,
      sessionIds: mine.map((e) => e.sessionId),
      paymentLinkSentAt: sent.length ? sent[sent.length - 1] : undefined,
      merchandiseOrder: latest
        ? {
            clinicId: latest.sessionId,
            items: latest.items,
            tuitionCents: latest.tuitionCents,
            swagCents: latest.swagCents,
            totalCents: latest.totalCents,
            paidAt: latest.paidAt,
          }
        : undefined,
    });
  });

  return normalizeRegistrationState({
    programs: docs.programs.map((p) => without(p, "orgId")),
    sessions: docs.sessions.map((s) => without(s, "orgId")),
    players,
  });
}
