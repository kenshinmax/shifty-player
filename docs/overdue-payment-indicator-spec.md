# Technical Implementation Specification: Overdue Payment Indicator

Status: **Draft — awaiting approval**
Scope: Admin dashboard financials view. **No payment-processing code is modified.**

## 1. Background and platform reality check

Shifty Player is a Next.js 16 (App Router) / React 19 application with a
Node.js API layer and MongoDB persistence (`lib/db/doc-store.ts` abstracts
Mongo and an in-memory fallback used by tests). Payments run through Stripe
PaymentIntents in test mode with an asynchronous verification worker.

Two facts shape this spec:

1. **There are no subscriptions.** Parents pay one-time clinic tuition via
   Stripe Payment Elements. "Overdue subscription payment" is therefore
   implemented as an **overdue unpaid enrollment**, derived from existing
   payment data (approved definition: the union of both conditions in §3).
2. The current "paid" signal is `Player.paymentLinkSentAt` — a legacy
   player-level flag meaning *"an admin sent a payment link"*, not *"money
   was received"*. The Stripe-verified source of truth is the `Enrollment`
   document (`status: "paid"`, `paidAt`, `stripePaymentIntentId`), written by
   the payment-verification worker via `markEnrollmentPaid`.

Note: `AGENTS.md` still describes an older localStorage-only architecture; the
server-side Mongo/Stripe flow documented here is what actually runs
(`README.md` is current).

## 2. Existing architecture (relevant parts only)

| Layer | File | Role |
| --- | --- | --- |
| Types | `lib/types.ts` | `Player`, `Enrollment`, `Session`, `Program`, `AppState` |
| Payment helpers | `lib/payment.ts` | `isPlayerPaid`, `filterPlayersByPaymentStatus` (`"all" \| "paid" \| "unpaid"`), `sortPlayersByTransactionDate` |
| Stripe integration | `lib/stripe.ts` | PaymentIntent creation/validation — **do not modify** |
| Verification worker | `lib/payment-verification.ts`, `lib/db/payment-verification-repository.ts` | Async `pending → verified → enrolled / failed` pipeline — **do not modify** |
| Enrollment persistence | `lib/db/registration-repository.ts` | `enrollPaidInDb` / `markEnrollmentPaid` (writes), `getStateForViewer` (read path this spec extends) |
| State API | `app/api/orgs/[orgId]/state/route.ts` | Serves viewer-scoped `AppState` (`force-dynamic`, org-admin gated) |
| Client state | `lib/use-player-store.ts`, `lib/storage.ts` | Fetches/normalizes `AppState`; spreads unknown fields through |
| Dashboard | `components/admin-dashboard.tsx` | Renders financials section, calls `syncFromStorage()` on entry |
| Financials table | `components/financials-players-table.tsx` | Filter tabs (all/paid/unpaid), status badges, "Send link" action |
| Styling | `app/globals.css`, `docs/brand-guidelines.md` | Token-based palette; status tones |

Collections touched (read-only): `enrollments`, `sessions`, `programs`,
`players`.

## 3. Definition of overdue (approved)

A player is **overdue** when they are not paid (no Stripe-verified paid
enrollment; see §5 decision D2) **and** at least one of:

- **Condition A (stale payment link):** an active enrollment's
  `paymentLinkSentAt` — falling back to the player's `paymentLinkSentAt` when
  the enrollment has none — is older than `OVERDUE_GRACE_DAYS = 7` days.
- **Condition B (clinic started):** the derived start date of an enrolled
  clinic has passed. Derived start date = the program's `startDate` when set,
  otherwise the first day of the session's `year`/`month` (UTC).

"Active" enrollment = `status !== "removed"`. Overdue is computed
**server-side** at state-read time and shipped as data, not recomputed in the
browser (one clock, testable, no hydration mismatch).

## 4. Changes

### 4.1 New pure module — `lib/overdue.ts`

No I/O, injected `now: string | Date`, so it is fully unit-testable:

```ts
export const OVERDUE_GRACE_DAYS = 7;

export type PlayerPaymentStatus = {
  paid: boolean;              // Stripe-verified paid, or legacy flag fallback
  overdue: boolean;
  overdueEnrollmentIds: string[];
  maxDaysOverdue?: number;    // for UI text ("Overdue by 12 days")
};

export function deriveClinicStartDate(
  session: Session, program?: Program,
): string | null;

export function computePlayerPaymentStatus(
  player: Player,
  enrollments: Enrollment[],   // active enrollments for this player; may be []
  sessions: Session[],
  programs: Program[],
  now: Date,
): PlayerPaymentStatus;
```

Rules inside `computePlayerPaymentStatus`:

- Paid = any active enrollment with `status === "paid"`. When the player has
  **no enrollment documents at all** (legacy roster players, sample data),
  fall back to `Boolean(player.paymentLinkSentAt)` so current behavior is
  preserved exactly where enrollment data does not exist.
- For each unpaid active enrollment, evaluate Condition A then Condition B.
  Player is overdue if any enrollment matches either condition.
- All date math in UTC against ISO strings; invalid/missing dates never throw
  (treat as "condition not met").

### 4.2 Type addition — `lib/types.ts`

```ts
export type AppState = {
  // ...existing fields...
  /** Server-computed per-player payment status (overdue indicator). */
  paymentStatus?: Record<string, PlayerPaymentStatus>;
};
```

Additive and optional: `normalizeRegistrationState` spreads it through
unchanged, and no existing consumer breaks.

### 4.3 Read-path enrichment — `lib/db/registration-repository.ts`

`getStateForViewer` already reads the `enrollments` collection for seat
counts. Extend it (and the state returned by `getRegistrationState`) to load
the org's enrollments once and build `paymentStatus` via
`computePlayerPaymentStatus` for each visible player. **Read-only**: no
writes, no Stripe API calls, no changes to `enrollPaidInDb`,
`markPaymentLinkSentInDb`, the worker, or the webhook.

The state API route needs no changes — it already returns the whole
`AppState` JSON.

### 4.4 Filter extension — `lib/payment.ts`

```ts
export type FinancialsPaymentFilter = "all" | "paid" | "unpaid" | "overdue";
```

`filterPlayersByPaymentStatus` gains the `"overdue"` case, reading the
`paymentStatus` map passed in by the caller. `isPlayerPaid` is updated per
decision D2 (§5) to prefer the server-computed `paid` value with the existing
legacy fallback. `sortPlayersByTransactionDate` is unchanged; overdue players
may optionally sort first within the Unpaid/Overdue views (recommended).

### 4.5 UI — `components/financials-players-table.tsx`

New prop `paymentStatus?: Record<string, PlayerPaymentStatus>` (wired from
`state.paymentStatus` in `admin-dashboard.tsx`).

- **Filter tabs:** add `Overdue` between `Paid` and `Unpaid`, with count.
  Overdue is a subset of unpaid: the `Unpaid` tab continues to include
  overdue players so no one disappears between tabs.
- **Badge:** in the Status column, unpaid players whose `overdue` is true get
  `<Badge variant="destructive">Overdue by N days</Badge>` replacing the
  plain `Unpaid` badge. Rationale vs. the brand guideline's amber "warning"
  tone: overdue is an alarm state distinct from ordinary "pending", and the
  guidelines reserve `--destructive` for exactly this. (Amber is acceptable
  if the reviewer prefers it; one-line change.)
- **Transaction cell:** secondary line for overdue players reads
  "Overdue — due N days ago" instead of "Transaction pending".
- Empty-state copy for the Overdue tab: "No overdue payments."
- No changes to the Send-link action, table layout, or any other section.

### 4.6 Explicitly out of scope / untouched

`lib/stripe.ts`, `lib/payment-verification.ts`,
`lib/db/payment-verification-repository.ts`, the Stripe webhook route,
`confirm-enrollment` / `enrollPaidInDb`, `markPaymentLinkSentInDb`, metrics,
HubSpot sync, and all parent-facing pages. No new npm dependencies. No new
environment variables (`OVERDUE_GRACE_DAYS` is a constant; can be promoted to
env later if ops asks).

## 5. Decisions for reviewer sign-off

- **D1 (approved via questionnaire):** overdue = union of stale-link and
  clinic-started conditions.
- **D2 (recommended, needs approval):** "paid" for overdue purposes means
  *Stripe-verified* (`Enrollment.status === "paid"`), not just "a link was
  sent". Consequence: a legacy player whose link was sent but who never
  completed payment will now correctly show Unpaid/Overdue instead of
  "Enrolled / Paid". This changes badge text for that cohort in the
  financials view only; without it, the Overdue badge would contradict the
  existing Paid badge on the same row. Players with no enrollment documents
  keep today's behavior.
- **D3 (recommended):** badge tone `destructive`; fallback amber.

## 6. Edge cases

| Case | Behavior |
| --- | --- |
| Player with no enrollments (roster-only, org-added) | Never overdue |
| `removed` enrollment | Ignored by overdue logic |
| Multiple clinics, one overdue | Player flagged once; tooltip/count shows each overdue clinic |
| Enrollment missing `paymentLinkSentAt` and clinic not started | Not overdue (nothing to chase yet) |
| Payment verification `failed` after max attempts | Player stays unpaid/overdue; existing retry API (`POST /api/payments/[id]/retry`) remains the fix path |
| Demo mode (no Stripe keys) | Works identically — everything derives from Mongo/memory data |
| Legacy player, no enrollment docs | Falls back to `player.paymentLinkSentAt`; overdue only via Condition A/B against player fields |
| Paid + stale link | Never overdue (paid wins) |
| Invalid/missing session or program dates | Condition B skipped, no crash |
| Clock/timezones | Server UTC only; `now` captured once per state read |

## 7. Dependencies and risks

**Dependencies:** none new. Uses existing `enrollments` data written by the
untouched verification worker.

**Risks and mitigations**

- *D2 semantics change* — the only behavioral change. Mitigated by the legacy
  fallback (§4.1) and confined to the admin financials view; parent-facing
  pages do not read `isPlayerPaid`.
- *Stale overdues after late payment* — overdue clears only when state is
  refetched. The dashboard already calls `syncFromStorage()` when entering
  Financials, and every mutation returns fresh state, so exposure is one
  navigation; acceptable for an MVP.
- *Read amplification* — one extra `find` on `enrollments` per state request,
  alongside the existing seat-count read; negligible at MVP scale.
- *In-memory store divergence* — none; overdue logic sits above `DocStore`,
  which already abstracts Mongo vs. memory.
- *Stripe API coupling* — none; no Stripe calls on the read path, so no added
  latency or rate-limit risk.

## 8. Implementation plan

1. **Phase 1 — pure logic:** `lib/overdue.ts` + Vitest unit tests
   (`__tests__/overdue.test.ts`).
2. **Phase 2 — server read path:** `paymentStatus` in
   `getStateForViewer`; extend `__tests__/registration-repository.test.ts`
   with paid/unpaid/overdue/no-enrollment fixtures.
3. **Phase 3 — UI:** filter tab + badge + copy in
   `financials-players-table.tsx`, wiring in `admin-dashboard.tsx`; update
   `filterPlayersByPaymentStatus` tests in `__tests__/payment.test.ts` and
   table tests in `__tests__/players-table.test.tsx`.
4. **Phase 4 — E2E and docs:** Playwright scenario (seeded backdated
   `paymentLinkSentAt` → badge and Overdue tab visible; complete demo
   checkout → badge clears); README note under the Stripe section.

Each phase lands with its tests green (`npm test`, `npm run lint`); E2E via
`npm run test:e2e`.

## 9. Testing requirements

**Unit (Vitest)**

- Grace boundary: link exactly 7 days old → not overdue; 7 days + 1 second →
  overdue.
- Condition B: unpaid + clinic start date passed (program `startDate` set and
  unset → derived from session month) → overdue; future clinic → not.
- Paid enrollment suppresses overdue; `removed` enrollments ignored; multiple
  enrollments aggregate; `maxDaysOverdue` is the max across enrollments.
- Legacy fallback: no enrollment docs → player-level flag used; behavior
  identical to today.
- Filter: `"overdue"` returns exactly the unpaid ∩ overdue set; counts in tab
  labels match.

**Repository**

- `getStateForViewer` populates `paymentStatus` for the viewer's org; players
  from other orgs never appear; memory and Mongo stores behave identically.

**Component (Testing Library)**

- Overdue tab renders with correct count; badge shows on overdue rows with
  day text; paid and plain-unpaid rows unchanged; empty-state copy.

**E2E (Playwright, demo checkout — no real Stripe)**

- Seed/backdate a link, verify badge + filter, pay via demo card flow, verify
  badge clears after state refresh.

**Manual (test mode)**

- With `stripe listen` running: pay a real test-mode PaymentIntent, confirm
  the worker enrolls (`pending → enrolled`) and the overdue badge clears.
