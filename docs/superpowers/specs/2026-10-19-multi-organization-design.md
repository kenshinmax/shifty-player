# Multi-organization Shifty Player platform — design

Date: 2026-10-19
Status: Approved in brainstorming, pending spec review

## Goal

Turn Shifty Player from a single basketball program's registration site into a
platform. Any organization (club, academy, camp) can sign up, create programs,
camps and clinics, open registration to its families, take payment directly,
and manage its own players, rosters, registrations and orders. Shifty Player's
own camps become the first organization on the platform.

### Success criteria

- An organization can go from sign-up to taking a paid registration without
  Shifty editing code or data by hand. The only manual step is approval.
- An organization's admins can never read or change another organization's
  data. Automated isolation tests enforce this.
- A parent uses one account to register children with several organizations.
- Payments go to the organization's own Stripe account, with an optional
  platform fee for Shifty.
- Today's Shifty camps keep working at their new URLs, and old links redirect.

### Non-goals (this spec)

Coach and staff roles, custom domains and subdomains, a HubSpot connection for
each organization, email delivery for invites, organization search, archive
features.

## Current state (what forces the design)

- `Program`, `Session` (clinic) and `Player` in `lib/types.ts` have no owner
  field. `GET /api/state` returns all of them to anyone who calls it.
- `lib/db/registration-repository.ts` saves by loading the whole state,
  editing it, then deleting and re-inserting the `programs`, `sessions` and
  `players` collections. A queue inside the process orders the writes. This
  can't work for many organizations: every save rewrites every organization's
  data.
- Roles are app-wide: `role: "user" | "admin"`. `requireAdmin` in
  `lib/api-auth.ts` checks only that role.
- There is one Stripe key and one HubSpot token, both set in environment
  variables.
- A player record mixes the child's profile (`name`, `grade`, `level`) with
  enrollment (`programIds`, `sessionIds`) and order data
  (`merchandiseOrder`).

## Decisions

| Topic | Decision |
| --- | --- |
| Tenancy | Shared collections. Every org-owned record carries `orgId`, and all access goes through an org-scoped repository |
| URLs | Path slug: `/o/[slug]/…` |
| Families | One parent account. Children belong to the parent and can enroll with any organization |
| Onboarding | Self-serve creation. Going live requires Stripe onboarding to be complete and a platform admin's approval |
| Payments | Stripe Connect Express. Destination charges with `on_behalf_of` and an optional `application_fee_amount` |
| `/` | Platform landing page. Today's camp marketing moves to `/o/shifty-player` |
| Org roles | `owner` and `admin` only. Coaches come later |

Alternatives considered: a separate database per organization (makes reporting
across organizations and shared children awkward) and one document per
organization (hits Mongo's 16 MB document cap, and every save for an
organization competes for a single document).

## Data model

All IDs are strings, as today. Each collection gets a unique index on `id`.
Org-owned collections also get an index on `{ orgId: 1, id: 1 }`.

**`organizations`**
- `id`, `slug` (unique), `name`, `logoUrl?`
- `status`: `draft` | `pending_review` | `live` | `suspended`
- `stripeAccountId?`, `stripeChargesEnabled: boolean`
- `platformFeeBps: number` (default `0`)
- `hubspotEnabled: boolean` (default `false`; `true` for `shifty-player`)
- `createdAt`, `approvedAt?`

**`users`** (existing): drop `role`, add `isPlatformAdmin: boolean`.

**`memberships`**: `id`, `userId`, `orgId`, `role: "owner" | "admin"`,
`createdAt`. Unique on `{ userId, orgId }`.

**`org_invites`**: `id`, `orgId`, `email`, `role`, `token`, `createdAt`,
`claimedAt?`. This is a pending admin invite. If the email already belongs to
a user, the membership is created at once instead.

**`children`** (from today's `Player`, minus the enrollment and order fields):
`id`, `parentUserId?`, `createdByOrgId?`, `name`, `email`, `grade`, `level`,
`avatarUrl?`. Not owned by any organization. `parentUserId` is absent, and
`createdByOrgId` is set, for roster players an organization's admin adds
directly.

**`programs`**, **`sessions`**: today's fields plus `orgId`.

**`enrollments`**: `id`, `orgId`, `childId`, `programId`, `sessionId`,
`status: "pending" | "paid" | "removed"`, `paidAt?`,
`stripePaymentIntentId?`, `paymentLinkSentAt?`, `createdAt`. This replaces
`Player.programIds`, `Player.sessionIds` and `Player.paymentLinkSentAt`.

**`orders`**: `id`, `orgId`, `parentUserId`, `childId`, `sessionId`, `items[]`
(the same shape as today's `merchandiseOrder.items`), `tuitionCents`,
`swagCents`, `totalCents`, `platformFeeCents`, `stripePaymentIntentId`,
`paidAt`. This replaces `Player.merchandiseOrder`.

**`processed_payments`** (existing): unchanged.

**Visibility rule:** an organization can read a child's details only while
that child has an enrollment with that organization whose status is not
`removed`, or when the organization created the child (`createdByOrgId`).
Orders are never deleted, even when the child is. An organization's roster is enrollments joined to children.

## Data access layer

- `lib/db/org-repository.ts` exports `forOrg(orgId)`. It returns
  `programs`, `sessions`, `enrollments`, `orders` and `roster`, and every
  method adds `orgId` to the filter and to inserts. Writes update one record
  at a time with `updateOne` / `insertOne`. The rewrite-everything saves and
  the in-process write queue are removed.
- `lib/db/family-repository.ts` handles operations a parent performs on their
  own data: their children, and their enrollments and orders across
  organizations.
- `lib/db/platform-repository.ts` handles organization records and cross-org
  counts. Only platform-admin routes use it.
- Route handlers must not import collection names or `getDb` directly. A Vitest
  check (grep over `app/api/**`) fails if they do.
- The in-memory fallback used when Mongo isn't configured keeps working,
  behind the same interfaces.

## Routes and pages

| Route | Access | Contents |
| --- | --- | --- |
| `/` | Public | Platform landing page: "Register your organization", list of live organizations |
| `/signup/org` | Signed-in user | Create an organization (name, slug, logo). The creator becomes `owner`; status starts as `draft` |
| `/o/[slug]` | Public | The organization's home page (today's home content for `shifty-player`) |
| `/o/[slug]/programs`, `/clinics`, `/showcases` | Public | Today's pages, scoped to the organization. Register buttons show only when the organization is `live` and the program is `open` |
| `/o/[slug]/register/[childId]/[clinicId]` | Parent | Today's `/player/registration/…` checkout |
| `/o/[slug]/admin/…` | Owner, admin | Today's `/dashboard` tabs plus Settings (profile, Stripe connect, members, "Submit for review") |
| `/account` | Signed-in user | Today's `/player`: children, plus enrollments and orders grouped by organization |
| `/platform` | Platform admin | Organization list with status and counts; approve and suspend |

- `app/o/[slug]/layout.tsx` resolves the slug. It returns 404 if the
  organization is unknown, or suspended (except for that organization's own
  members), and provides the organization through `OrgProvider`. The
  registration provider loads org-scoped state.
- `GET /api/state` is removed.
- Old URLs redirect: `/dashboard` → `/o/shifty-player/admin`,
  `/programs` → `/o/shifty-player/programs`,
  `/clinics` → `/o/shifty-player/clinics`,
  `/showcases` → `/o/shifty-player/showcases`, `/player` → `/account`,
  `/dashboard/programs/…` → `/o/shifty-player/admin/programs/…`.
- After login: a platform admin goes to `/platform`; a user with exactly one
  membership goes to that organization's admin; a user with several
  memberships gets an organization picker; everyone else goes to `/account`.
  A safe `next` parameter still wins, as today.

## APIs and permissions

- Org-scoped endpoints live under `/api/orgs/[orgId]/…`: programs, clinics,
  roster, enrollments, payment links, settings, members, Stripe onboarding.
- `requireOrgRole(request, orgId, roles)` replaces `requireAdmin`. It returns
  `{ user, membership, repo: forOrg(orgId) }`, or a 401 when the user isn't
  signed in and a 404 when they aren't a member.
- `requirePlatformAdmin(request)` guards `/api/platform/*`.
- Public `GET /api/orgs/[orgId]/programs` returns programs and clinics only,
  and never player data.
- Owners and admins have the same permissions, except that only an owner can
  manage Stripe, manage members, or delete the organization.
- Status transitions:
  - `draft` → `pending_review`: owner submits; requires `stripeChargesEnabled`.
  - `pending_review` → `live`: a platform admin approves.
  - `pending_review` → `draft`: a platform admin rejects, with a note.
  - `live` ↔ `suspended`: a platform admin, at any time.
- A request for another organization's record returns 404, never 403.

## Payments (Stripe Connect)

- **Onboarding:** the owner clicks "Connect Stripe". The server creates an
  Express account (if there isn't one yet), stores `stripeAccountId`, and
  redirects to a Stripe Account Link. The return URL is
  `/o/[slug]/admin/settings`. An `account.updated` webhook updates
  `stripeChargesEnabled`.
- **Charge:** `create-payment-intent` checks that the organization is `live`
  with `stripeChargesEnabled`, the program is open, the clinic is available,
  and the clinic has capacity left. It then creates the PaymentIntent on the
  platform account with:
  - `transfer_data.destination = org.stripeAccountId`
  - `on_behalf_of = org.stripeAccountId`
  - `application_fee_amount = round(totalCents * platformFeeBps / 10000)`
  - `metadata.orgId` plus today's metadata
- **Webhook:** `payment_intent.succeeded` loads the organization from
  `metadata.orgId`, checks again that the clinic belongs to that organization,
  claims the payment idempotently (existing `claimProcessedPayment`), then
  writes the enrollment as `paid` and the order. HubSpot sync runs only when
  `org.hubspotEnabled`.
- The client Payment Element is unchanged. It still uses the platform
  publishable key.
- Refunds and disputes are debited from the platform balance and recovered
  from the connected account. The platform admin handles them in the Stripe
  dashboard for now.

## Metrics and HubSpot

- Metrics events gain `orgId`. The organization's insights tab filters by it,
  and `/platform` aggregates across organizations.
- HubSpot keeps today's single token and syncs only for organizations with
  `hubspotEnabled`. A HubSpot OAuth connection for each organization is a
  later sub-project.

## Slugs

Slugs match `^[a-z0-9]+(-[a-z0-9]+)*$`, are 3–40 characters, unique, and not
in the reserved list: `admin`, `api`, `platform`, `account`, `signup`,
`login`, `o`, `www`, `app`, `dashboard`, `static`, `_next`. A slug can be
edited while the organization is `draft` and is locked after that.

## Migration

`scripts/migrate-to-orgs.ts` is a one-off script. It is idempotent and safe to
re-run.

1. Create organization `shifty-player` (status `live`, `hubspotEnabled: true`).
2. Set `orgId` on every program and session.
3. For each existing player: create a `children` record with the same `id`.
   Players with no `parentUserId` get `createdByOrgId: shifty-player`.
   Create an `enrollments` record (id `enr-<childId>-<sessionId>`) for each
   entry in `sessionIds`. Its status is `paid` when the player's
   `merchandiseOrder` is for that clinic, and `pending` otherwise. Legacy data
   can't tell paid tuition-only enrollments apart, because processed payments
   aren't linked to players. Create an `orders` record from
   `merchandiseOrder`.
4. Only after verification counts match (children = players, enrollments =
   valid `sessionIds`), move the `players` documents to `players_legacy`.
5. (Phase 3) Convert users: `role: "admin"` → `isPlatformAdmin: true` plus an
   `owner` membership of `shifty-player`; `role: "user"` → neither.

Until the migration has run, the app refuses to serve registration data if a
legacy `players` collection is present.

Phase 1 keeps the existing in-process write queue. The legacy whole-state API
stays in front of the new collections until Phase 2.

The sample data in `lib/sample-data.ts` is updated to the new shape. Its
default is one organization with one 2026 session and 10 registered players,
as the AGENTS.md MVP requires. A second organization is seeded for tests only.

Before cutover, the Shifty organization completes Express onboarding in Stripe
test mode and then live mode.

## Error handling

- All registration preconditions are enforced on the server in both
  `create-payment-intent` and the webhook. Hiding buttons is only for UX.
- Suspended organization: public pages return 404, members see a banner, and
  new PaymentIntents are refused. Existing data is kept.
- Webhook with an unknown `orgId`, or a clinic that belongs to a different
  organization: log it, record a `processed_payments` entry with an error
  status, return 200 (so Stripe doesn't keep retrying), and do not enroll.
- Slug conflict at signup: inline form error.
- Stripe onboarding left unfinished: Settings shows "Finish Stripe setup" with
  a fresh Account Link.

## Testing

- **Unit (Vitest):** `forOrg` scoping on every method; `requireOrgRole` and
  `requirePlatformAdmin`; slug validation; status transitions; PaymentIntent
  parameters (destination, `on_behalf_of`, fee rounding); the migration
  script against a fixture of today's data; the "no direct collection access
  in routes" check.
- **Isolation suite:** seed organizations A and B. Call every
  `/api/orgs/[orgId]/…` endpoint as A's admin using B's org ID and B's record
  IDs; every call must return 404 or an empty result.
- **E2E (Playwright, with Stripe/HubSpot/Mongo stubbed or isolated as in
  commit 190bd67):**
  1. User signs up → creates an organization → builds a program and clinic →
     Stripe onboarding stubbed → submits for review → platform admin
     approves → a parent registers a child at `/o/[slug]`.
  2. A parent with children in two organizations sees both on `/account`;
     each organization's roster shows only its own enrollment.
  3. Old URLs redirect to their `shifty-player` equivalents.

## Build order

Each phase ships on its own and keeps the app working.

1. **Data layer:** new collections, per-record repositories, `forOrg`,
   migration script, sample data in the new shape. The UI looks the same and
   reads `shifty-player` implicitly.
2. **Routing:** `/o/[slug]/…`, `OrgProvider`, redirects, platform landing
   page at `/`, `/account`, `/api/state` removed.
3. **Organizations and roles:** `/signup/org`, memberships, invites,
   `requireOrgRole`, `/platform` approval, status transitions.
4. **Stripe Connect:** Express onboarding, `account.updated`, destination
   charges, platform fee, webhook org checks.
5. **Later (separate specs):** HubSpot connection per organization, coach
   roles, custom domains.
