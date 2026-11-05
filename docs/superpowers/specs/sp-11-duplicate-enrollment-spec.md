# SP-11 / BUG-142: Prevent duplicate enrollment and checkout

**Jira:** [SP-11](https://go-shimmy.atlassian.net/browse/SP-11)

**Status:** Draft for approval, not implemented

**Repository baseline:** `ca32009`

**Scope:** Repository investigation, proposed code changes, and verification plan.

## 1. Problem and intended outcome

Jira reports that a parent can add a player through “Register for Programs” and produce duplicate records for the same session, with confusing payment status and possible duplicate charges. It cites Spring Camp as an example. There are no Jira comments or linked issues. The attachment was listed, but its image was not inspected.

A verified fix must prevent repeated requests, stale pages, and parallel checkouts from charging the same enrollment twice. It must also prevent retries of one child-creation operation from creating different child IDs. Hiding duplicate roster rows is not a fix.

This document does not claim to reproduce a production charge or establish that every reported duplicate has the same cause. Findings below come from repository inspection; the current automated tests supply a baseline, not proof of the proposed fix.

## 2. Repository findings

| Location | Observed behavior and consequence |
| --- | --- |
| `components/parent-program-registration.tsx:77–134` | Continue validates client state. Save child has no in-flight guard, so repeated submissions can call child creation more than once. |
| `lib/db/family-repository.ts:10–28` | Every valid `addChild` request generates a new UUID. Retrying the same operation creates another child; no request identity is recorded. |
| `lib/player-store.ts:47–78` | `validateClinicRegistration` checks the child, program, clinic, availability, existing **clinic** registration, and capacity. It is not called before Stripe intent creation. |
| `app/api/stripe/create-payment-intent/route.ts:82–115` | Checks organization access, child ownership, and clinic/program association. Does not reject an existing enrollment, closed program, unavailable clinic, or full clinic before creating an intent. Every accepted request calls Stripe create without an idempotency key. |
| `components/registration-review.tsx:529–571` | Mounting the Stripe section or changing the cart creates another PaymentIntent. Ignoring a stale response does not cancel its server-side intent. |
| `components/registration-review.tsx:845–848, 984–1020` | A freshly loaded paid child/clinic hides checkout. This protection relies on local `sessionIds`, `programIds`, and the player-wide `paymentLinkSentAt`; it does not serialize stale tabs or direct requests. |
| `lib/db/registration-repository.ts:486–537` | Paid enrollment is a no-op for a child already in that clinic with a payment-link flag. This happens **after charging**, and does not distinguish a replay of the original payment from a different payment for the same enrollment. |
| `lib/payment-verification.ts:130–174` | Calls enrollment, then claims once-only side effects by PaymentIntent ID. Two different intents have different claims; per-payment idempotency does not prevent duplicate business checkouts. |
| `lib/db/legacy-state.ts:21–23, 76–96` | Enrollment IDs derive from child and session. This helps keep one document for one child/session, but two child IDs for the same person remain distinct. |
| `lib/db/registration-repository.ts:81–95` | Registration mutations use a process-local promise queue. It does not coordinate multiple application processes. |
| `lib/db/doc-store.ts:40–44, 151–164` | Unique indexes cover document IDs and organization/document IDs, not an explicit active checkout business key. |
| `lib/types.ts:154–167`; `lib/db/org-repository.ts:146–156` | Enrollment already supports pending/paid/removed and a Stripe intent reference. `enrollPaidInDb` does not pass that reference through its current signature. |

### Root-cause assessment

1. **Confirmed server gap:** checkout creation is not guarded by enrollment eligibility or a durable single-checkout claim. A client validation check and a post-payment no-op cannot prevent duplicate charges.
2. **Confirmed retry gap:** child creation is not idempotent, and its UI does not lock submission. Distinct child IDs can bypass an otherwise valid child-ID enrollment check.
3. **Unconfirmed incident attribution:** request traces and affected database records would be needed to decide which path produced the Spring Camp example. Do not inspect or change production data as part of this draft.

### Existing specification conflict

`documentation/planned/player-enrollment-prd.md` says one active enrollment per **program** in FR1, but its open questions allow different clinic weeks within the same program. Existing code enforces a clinic-level rule and supports multiple weeks.

**Recommended rule for this bug fix:** one active enrollment and one chargeable checkout per `(orgId, childId, sessionId)`. Keep different clinic weeks and different organizations independent. Product approval is required before implementation; do not silently turn the clinic restriction into a program-wide restriction.

## 3. Acceptance criteria

1. An already-paid enrollment rejects a new checkout with HTTP `409` and a stable code such as `ALREADY_ENROLLED`, before any Stripe creation call.
2. Repeated or simultaneous requests for an unpaid enrollment resolve to the same checkout and PaymentIntent, including across server processes.
3. A pending checkout offers resume/verification, not a second payment. A declined payment can retry the same intent when Stripe permits it.
4. A replay of the same successful PaymentIntent produces no additional enrollment, order, payment-success side effect, or external sync.
5. A different PaymentIntent cannot silently claim an enrollment already associated with another successful payment.
6. Retrying one Save child operation returns the same child ID. Different families and genuinely different children are not merged by name.
7. The UI shows a clear reason or resume action for blocked registration. Authorization and other families' privacy remain unchanged.
8. Removal permits a new enrollment attempt without letting an old webhook restore a removed registration.

## 4. Proposed implementation

Changes in this section are recommendations for approval, not authorization to modify payment processing or database schemas. Both require explicit approval under `AGENTS.md`.

### 4.1 Validate before checkout

Reuse `validateClinicRegistration` for new registrations against current server state after authentication and ownership checks. Keep the existing organization-access behavior, including concealed non-live organizations for parents.

Check authoritative enrollment status instead of inferring paid status from `paymentLinkSentAt`. Do not let payment in another clinic mark this clinic paid. Distinguish a resumable pending checkout from an already-paid enrollment before applying new-enrollment validation.

Return structured conflict codes plus readable messages. Example: `409 { code: "ALREADY_ENROLLED", error: "This child is already enrolled in this clinic." }`. Never include another family's details.

### 4.2 Make checkout acquisition durable and idempotent

Introduce a small checkout repository and checkout record, separate from the legacy `Player` projection. Store organization, child, program, session, attempt ID, payer, server-priced cart fingerprint, PaymentIntent ID, and lifecycle state.

- Use a database-enforced unique active key for `(orgId, childId, sessionId)`. An atomic insert/conditional update, not a read followed by an unconditional write, selects the checkout owner.
- Create Stripe intents with an idempotency key derived from the persisted attempt ID. Persist that ID **before** calling Stripe so timeout/crash recovery uses the same key.
- A concurrent request receives the existing checkout, or a temporary “checkout preparing” response while its intent is being recovered. It must not create a second attempt.
- Reconcile ambiguous Stripe timeouts using the existing attempt. Never release a claim merely because an HTTP request timed out.
- Resume an existing unpaid intent for an identical cart. For the first version, freeze the cart once secure payment starts. An explicit change-order action must cancel the old intent and confirm cancellation before opening a replacement attempt. A succeeded or processing intent cannot be replaced.
- Release an abandoned attempt only after Stripe confirms that its intent is canceled or otherwise cannot succeed. A local expiry alone is not sufficient.
- Bind the payer to the authenticated account and the enrollment tuple to server-validated resources; callers cannot choose the durable key or another family's checkout.
- Implement equivalent atomic behavior in the memory store and real MongoDB. Do not rely on the current global promise queue for distributed safety.

The checkout lifecycle must be documented and tested as `preparing → ready → processing → paid`, with a canceled terminal path. Transient errors retain the recoverable attempt. A replacement uses a new attempt ID while retaining old payment references for reconciliation.

This is duplicate-checkout protection, not a full capacity-reservation system. Check capacity before new checkout, but do not claim that this alone prevents two different children paying for the final seat. Strict no-charge oversell prevention from the broader PRD needs a separately approved seat-reservation design.

### 4.3 Bind confirmation to the payment and enrollment

Pass PaymentIntent ID and checkout attempt identity through verification to the enrollment repository. Atomically associate the successful payment with the child/session checkout and enrollment:

- Same payment and same attempt: return the existing confirmed result.
- Different payment for an already-paid enrollment: record a reconciliation failure; do not overwrite the original payment, paid time, or order, and do not report successful enrollment of the second charge.
- Validate organization, child, program, session, payer, currency, and amount against the stored checkout and trusted Stripe result.
- Preserve compatibility for intents created before the new checkout records: verify them through an explicit legacy path, bind their payment reference atomically, and flag conflicting payments. Do not reject all in-flight payments at deployment.
- Preserve existing webhook signature verification and verification-job deduplication. A checkout conflict is not fixed by claiming `processed_payments` earlier.
- Removal ends the active checkout generation. A late webhook for an older generation cannot reactivate it or replace a later payment.

Enrollment confirmation and durable order persistence must be retry-safe as one logical operation. Use a transaction or an atomic payment-bound record plus idempotent reconciliation writes; prove recovery after failures between writes. Keep existing metrics and CRM behavior unless the replay tests identify an in-scope duplication.

An already-successful conflicting legacy payment requires operator review. Automatic refunds, new charges, production cleanup, and new external notifications are out of scope.

### 4.4 Make child creation retry-safe

Generate a client operation ID once per new-child form attempt and preserve it across retries. The server scopes it to the authenticated parent, stores the operation identity atomically with the created child, and returns the existing child for a replay with the same normalized payload. Reuse with a different payload returns `409`.

Disable Save child while saving and use a synchronous in-flight guard, with `finally` cleanup after errors. Apply equivalent guards to payment submit handlers; disabled buttons alone do not provide server correctness.

Do **not** add a uniqueness constraint on child name, email, grade, or skill level. Those values do not uniquely identify a person. Before creating a new child, show matching existing household children and encourage selection, without automatically merging them. Intentional creation of another ID for the same real-world child remains an identity-policy limitation requiring product direction.

### 4.5 Proposed file changes

| Files | Planned changes |
| --- | --- |
| `app/api/stripe/create-payment-intent/route.ts` | Eligibility, structured conflicts, acquire/resume durable checkout rather than unconditionally create an intent. |
| `lib/db/checkout-repository.ts` (new); `lib/db/doc-store.ts`; `lib/types.ts` | Checkout lifecycle, active business key, atomic claim/update support, Mongo indexes and memory parity. |
| `lib/payment-verification.ts`; `lib/db/registration-repository.ts`; `lib/db/org-repository.ts` | Payment/attempt-bound confirmation, authoritative status, retry-safe order writes and removal handling. |
| `app/api/stripe/confirm-enrollment/route.ts`; `app/api/stripe/webhook/route.ts` | Resolve/validate checkout identity while preserving authenticated confirmation and signed webhook behavior, including legacy intents. |
| `app/api/orgs/[orgId]/registrations/enroll/route.ts` | Preserve demo/admin permissions, but enforce the same duplicate-enrollment invariant. |
| `lib/db/family-repository.ts`; `app/api/account/children/route.ts` | Parent-scoped child-creation operation identity and replay/conflict responses. |
| `lib/registration-api.ts`; `lib/use-player-store.ts` | Carry child operation identity and structured error/resume results. |
| `components/parent-program-registration.tsx`; `components/registration-review.tsx` | Submission guards, existing-child guidance, checkout resume, frozen cart, correct pending/paid messaging. |
| `lib/player-store.ts` | Reuse the existing validation rules; adjust only if needed for explicit structured results. |
| Relevant `__tests__/*`; new checkout/route/component tests; `e2e/registration.spec.ts` | Cases below, including actual Mongo concurrency coverage rather than memory-only assertions. |
| Database rollout/preflight script and release notes | Explicit, non-destructive rollout of the approved index/checkout changes. No automatic production deduplication. |

## 5. Verification plan

Use synthetic children and organizations. Route tests mock Stripe and assert call counts; a successful HTTP response alone is insufficient. Assert stored enrollment, checkout, order, and payment references, as well as unchanged original records.

### Unit and API cases

| ID | Setup/action | Required result |
| --- | --- | --- |
| U1 | Paid child/session; request another checkout | `409 ALREADY_ENROLLED`; zero Stripe create calls and no writes. |
| U2 | Pending checkout; repeat identical request | Same attempt and PaymentIntent; no second intent. |
| U3 | Two simultaneous first requests | One durable owner and one intent; other request resumes or reports preparing. |
| U4 | Stripe creates intent but response/persistence fails; retry | Recover same attempt with same Stripe idempotency key; one intent. |
| U5 | Declined payment, then retry | Same recoverable intent, no second chargeable checkout. |
| U6 | Cart change after payment preparation | Cart stays frozen; explicit replacement requires confirmed cancellation. No replacement while processing/succeeded. |
| U7 | Closed program, unavailable/full clinic, mismatched program, missing child | Reject before Stripe create; preserve existing authorization/status conventions. |
| U8 | Anonymous or wrong parent; guessed checkout/operation ID | `401` or concealed `404` as appropriate; no personal-data disclosure or Stripe call. |
| U9 | Same child in another week/organization; sibling in same clinic | Independent registration succeeds under the recommended clinic-level rule. |
| U10 | Payment for another clinic exists | This clinic's pending enrollment is not treated as paid by the player-wide flag. |
| U11 | Confirm request and webhook replay same successful payment | One paid enrollment, one order, one processed-payment claim, one worker success/CRM side effect. |
| U12 | Different successful intent targets already-paid enrollment | Original enrollment/order unchanged; second payment flagged for reconciliation, not reported as a new enrollment. |
| U13 | Stored/Stripe organization, child, clinic, payer, amount or currency differs | Verification fails without enrollment or success side effects. |
| U14 | Crash between confirmation, order write, claim, and final job update | Retry converges to one complete paid enrollment/order without extra charge or duplicate success side effects. |
| U15 | Remove enrollment, re-enroll, replay old webhook | New attempt allowed; old generation cannot revive/overwrite it. |
| U16 | Duplicate Save child requests, including parallel requests | Same parent/operation/payload returns one child ID; one child document. |
| U17 | Reuse child operation ID with different payload | `409`; existing child unchanged. Separate parent cannot access its result. |
| U18 | Same names in different households or distinct operations | No automatic merging or name-based rejection; existing-child guidance stays household-scoped. |
| U19 | Legacy paid intent arrives during rollout | Verified legacy path binds once; conflicting legacy payment is flagged. |
| U20 | Demo/admin repeated enrollment; invalid parent bypass with Stripe enabled | No additional active enrollment/order; existing online-payment requirement preserved. |

Extend `player-store.test.ts`, `registration-repository.test.ts`, `family-repository.test.ts`, `payment-verification.test.ts`, `stripe.test.ts`, API-boundary tests, and hook tests as appropriate. Add focused route tests for intent creation and component tests for child/payment submission guards. Keep existing removal, merchandise pricing, organization isolation, and authorization tests.

### Real MongoDB integration

Use an explicitly configured disposable test database, never `.env.local` or a production URI by default. Cover U3, U4, U12, U14–U17 using separate repository/application instances. Verify the intended unique index exists and incompatible duplicate keys fail. Synchronize requests with barriers, not arbitrary sleeps.

Also test startup/index creation against fixtures containing legacy records and duplicate business keys. Fail with an actionable report rather than deleting or rewriting those records.

### Browser and Stripe test-mode verification

1. Follow the existing parent registration scenario, complete a demo checkout, refresh, and revisit the same registration URL. Expect one active program row and no new payment form for a paid enrollment.
2. Rapidly submit Save child twice while delaying its response. Expect one request from the guarded UI and one child after server replay coverage.
3. Open two stale checkout tabs. In a mocked-Stripe/component test, both resolve to the same intent; only one confirm operation runs per form while submitting.
4. Show “already enrolled,” “resume payment,” and “verification pending” states without implying unpaid work is confirmed.
5. Verify frozen-cart and cancellation/replacement behavior, including cancel losing a race to payment success.
6. Verify another week and a sibling still register, and an unrelated parent cannot view the checkout.
7. In an explicitly approved Stripe **test-mode** environment, repeat the two-tab/retry scenario and inspect Stripe test records: one succeeded intent/charge for the enrollment and one order. Repeat webhook delivery and confirm counts remain unchanged.

The default Playwright configuration deliberately disables Stripe, MongoDB, and HubSpot. Its demo success cannot verify real charge prevention or multi-process Mongo behavior.

## 6. Baseline and execution

Executed against the unmodified application at `ca32009`:

```sh
PATH="/opt/homebrew/opt/node@24/bin:$PATH" ./node_modules/.bin/vitest run \
  __tests__/registration-repository.test.ts \
  __tests__/player-store.test.ts \
  __tests__/payment-verification.test.ts \
  __tests__/family-repository.test.ts
```

**Result:** Node `v24.16.0`, 4 files passed, **47 tests passed**. Vite emitted a configuration warning about future native config loading; it did not fail the run.

The initial baseline attempt under the shell's Node `v18.20.8` failed before tests started because `node:util` does not export `styleText`. Switching the command's PATH to an installed supported runtime allowed the baseline above; no dependencies or runtime configuration were changed. SP-13 separately tracks Node 20 test compatibility; that issue was not verified or fixed here.

After implementation, under a supported runtime:

```sh
npm test
npm run lint
npx next typegen && npx tsc --noEmit
NEXT_DIST_DIR=.next-sp11-build npm run build
npm run test:e2e -- e2e/registration.spec.ts
```

Also execute the new isolated Mongo integration suite and approved Stripe test-mode scenario. Record their exact commands with the implementation. For changed behavior, capture failing regression assertions on the baseline and passing assertions after the fix.

**Not executed for this specification:** new regression cases, browser tests, build, lint, type checking, Mongo integration, live Stripe/test-mode checkout, or production-data investigation. No verified-fix claim is possible until the new cases pass.

## 7. Approval and release gates

Before coding, approve:

1. Clinic-level uniqueness versus Jira's broader program wording.
2. Payment-processing and schema/index changes, including the durable checkout lifecycle, frozen-cart behavior, and cancellation/recovery policy.
3. Child retry idempotency without name-based deduplication. Decide separately whether stronger real-world child identity is required.
4. The narrower duplicate-checkout scope versus the broader PRD's final-seat/no-charge capacity guarantee.

Before release:

- Review affected records read-only with explicit authorization, and report counts without customer details. Distinguish duplicate child IDs, duplicate enrollment keys, and separate successful payments.
- Rehearse schema/index rollout on disposable fixtures or an approved sanitized copy. Do not deploy an index that fails on existing records without an approved remediation plan.
- Complete all relevant automated and test-mode checks. Preserve backward compatibility with in-flight intents.
- Keep checkout/payment-reference data if application code is rolled back. Do not reopen previously paid attempts or drop uniqueness protection as a rollback shortcut.
- Treat existing duplicate children, billing reconciliation, and refunds as separate, explicitly approved operations. This change prevents new duplicates; it does not repair past charges automatically.

**Definition of verified fix:** regression cases demonstrate the original gaps, the approved invariants hold under real Mongo concurrency and Stripe test-mode replay, relevant existing tests still pass, and evidence includes one enrollment, one order, and one successful payment for each tested enrollment attempt.
