# Multi-organization Phase 2: Org Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every organization gets its own URLs (`/o/[slug]/…`) and its own org-scoped APIs (`/api/orgs/[orgId]/…`). Parents get a cross-organization `/account`. `/` becomes the platform landing page. Visitors never receive player data they shouldn't see.

**Architecture:**
- **Repository:** the registration repository gains an `orgId` parameter on every function. A new `getStateForViewer(orgId, viewer)` returns a client-safe `AppState`: admins see their roster, parents see only their own children, the public sees no players. Each response also carries per-clinic `seatCounts`, so capacity still works without player data.
- **Client:** the client keeps today's `AppState`-based components. The global `RegistrationProvider` moves into an `app/o/[slug]/layout.tsx` that resolves the organization.
- **Removed:** old global routes and pages are deleted, and old URLs redirect.
- **Roles:** the `admin` role stays global until Phase 3 adds memberships.

**Tech Stack:** Next.js 16.3 App Router (route params are `Promise`s), TypeScript, MongoDB via `DocStore`, Vitest (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-multi-organization-design.md` (sections "Routes and pages", "APIs and permissions", "Data model → Visibility rule"). Phase 1 plan, for the existing layer: `docs/superpowers/plans/2026-10-19-multi-organization.md`.

## Global Constraints

- Read `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` and `15-route-handlers.md` before writing pages or routes (AGENTS.md). Route handlers use the repo's existing style: `context: { params: Promise<{ … }> }`, with `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`.
- **Visibility rule (spec):** an org can read a child only while the child has a non-`removed` enrollment with that org, or `createdByOrgId === orgId`.
- **Public reads never include player data.** For a public viewer, `players` is `[]`.
- **Missing orgs:** an unknown org id or slug, or a `suspended` org, returns **404** (API: `{ error: "Organization not found." }`; pages: `notFound()`). A record id that belongs to another org returns 404 or "not found" too, never 403.
- **Roles:** `role === "admin"` is still a global admin and counts as admin of every org (Phase 3 replaces it with memberships). `requireAdmin` stays.
- **Default org:** `DEFAULT_ORG_ID = "org-shifty-player"`, `DEFAULT_ORG_SLUG = "shifty-player"` (`lib/organizations.ts`). Only the default org is auto-created and auto-seeded with sample data.
- **Redirects:** old URLs redirect with `permanent: false`. `/` is not redirected; it becomes the platform landing page.
- **Brand tokens:** styling uses the tokens in `app/globals.css` and `docs/brand-guidelines.md`, not raw palette classes.
- **Test data:** unit tests use the memory store only. Never run the :3000 dev server, `npm run migrate:orgs`, or anything that reads `.env.local`. `npm run test:e2e` is safe; it blanks the Mongo, HubSpot and Stripe env vars.
- **Node:** it lives at `/opt/homebrew/bin`; prefix commands with `export PATH=/opt/homebrew/bin:$PATH &&`.

## Review Focus

1. **A visitor fetching an org's state API** must not receive any player names or emails, but clinic spot counts must still be right. (Test in Task 4.)
2. **A parent registering a child for the first time with an org.** The child has no enrollment there yet, so they aren't "visible" to the org. Registration must still succeed and not trip the child-ownership check. (Test in Task 2.)
3. **An org admin deleting a parent's child from the roster** removes only that org's enrollments. The child stays in the parent's account and in other orgs. (Test in Task 2.)
4. **Old bookmarks** (`/dashboard/programs/<id>`, `/player/registration/<child>/<clinic>`, `/player`) land on the matching new page. (Test in Task 9.)
5. **Stripe payments created before this release** have no `metadata.orgId` and must still enroll into the default org. (Test in Task 5.)

---

### Task 1: Seat counts replace player-based capacity math

**Files:**
- Modify: `lib/types.ts` (`AppState`), `lib/programs.ts`, `lib/player-store.ts` (`validateClinicRegistration`), `lib/use-player-store.ts` (`countPlayersForSession`)
- Modify callers: `components/registration-review.tsx`, `components/parent-program-registration.tsx`, plus any other caller `tsc` reports
- Test: `__tests__/programs.test.ts` (extend)

**Interfaces:**
- Produces:
  ```ts
  // lib/types.ts
  export type AppState = {
    programs: Program[]; sessions: Session[]; players: Player[];
    /** Enrolled-player count per clinic id, computed server-side from the full roster. */
    seatCounts?: Record<string, number>;
  };
  // lib/programs.ts
  export function seatsTaken(state: Pick<AppState, "players" | "seatCounts">, sessionId: string): number;
  export function getRemainingClinicSpots(state: Pick<AppState, "players" | "seatCounts">, clinic: Session): number; // was (players, clinic)
  export function getAvailableClinicsForProgram(state: Pick<AppState, "sessions" | "players" | "seatCounts">, programId: string): Session[]; // was (sessions, programId, players)
  export function buildSeatCounts(players: Player[]): Record<string, number>;
  ```
  `seatsTaken` returns `seatCounts[sessionId]` when `seatCounts` is present (missing key → 0). Otherwise it counts players whose `sessionIds` include the id.

- [ ] **Step 1: Write the failing tests:**
  - `seatsTaken prefers seatCounts` — `{ players: [], seatCounts: { s1: 7 } }` gives 7 for `s1` and 0 for `s2`.
  - `seatsTaken falls back to counting players`.
  - `remaining spots use seatCounts when players are hidden` — clinic capacity 10, `seatCounts {s1: 10}`, `players: []` → 0.
  - `buildSeatCounts counts each player once per clinic`.
- [ ] **Step 2: Run** `npx vitest run __tests__/programs.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement.**
  - Update the signatures.
  - `validateClinicRegistration` uses `getRemainingClinicSpots(state, clinic)`.
  - `usePlayerStore`'s `countPlayersForSession` returns `seatsTaken(state, id)`.
  - `normalizeRegistrationState` (`lib/storage.ts`) passes `seatCounts` through unchanged.
  - Fix every caller `npx tsc --noEmit` reports.
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit`. Expect all tests to pass and no type errors.
- [ ] **Step 5: Commit** with the message `Count clinic seats without needing player data`.

### Task 2: Org-parameterized registration repository, viewer views, child ownership

**Files:**
- Modify: `lib/db/registration-repository.ts`, `lib/db/org-repository.ts`
- Modify (callers, signature changes only): `app/api/**` routes that import the repository, and `__tests__/registration-repository.test.ts`
- Test: `__tests__/registration-repository.test.ts`, `__tests__/org-repository.test.ts` (extend)

**Interfaces:**
- Consumes: `seatsTaken` and `buildSeatCounts` (Task 1); `forOrg` and `assembleLegacyState` (Phase 1).
- Produces (`lib/db/registration-repository.ts`):
  ```ts
  export type Viewer = { kind: "admin" } | { kind: "parent"; userId: string } | { kind: "public" };
  export const ORG_NOT_FOUND = "Organization not found.";
  /** Full internal state for server use (webhooks, HubSpot). Never send to clients. */
  export function getRegistrationState(orgId: string): Promise<AppState>;
  /** Client-safe state: programs, sessions, seatCounts (always), players per viewer. */
  export function getStateForViewer(orgId: string, viewer: Viewer): Promise<AppState>;
  ```
  - Every existing `*InDb` function takes `orgId: string` as its **first** parameter. Their return shapes are unchanged: `{ state }` is still the full internal state, and routes convert it with `getStateForViewer`.
  - `addChildInDb` is **removed** (Task 3 replaces it).
  - `seedRegistrationState(state = sampleData)` and `resetMemoryRegistrationDb(state)` keep targeting the default org.
  - `loadDocuments(orgId)` throws `Error(ORG_NOT_FOUND)` when the organization doc doesn't exist, except that the default org is created on demand as today. Auto-seeding with sample data applies only to `DEFAULT_ORG_ID`.
  - Viewer `players`:
    - admin: assembled players whose child is visible to the org (spec visibility rule).
    - parent: players whose `parentUserId === userId`.
    - public: `[]`.
  - `seatCounts` = `buildSeatCounts` over **all** assembled players of the org.
- Child ownership (`forOrg(...).applyWrites`, `lib/db/org-repository.ts`):
  - A child upsert or removal is allowed only if the child id doesn't exist in the store yet, or the child is visible to this org, or this same batch upserts an active enrollment in this org for that child.
  - Otherwise `applyWrites` throws `Error("Child belongs to another organization.")` before writing anything.
- `deletePlayerInDb(orgId, playerId)`:
  - If the child has a `parentUserId`, the child is **kept**; only this org's enrollments for it become `removed`.
  - If the child was created by this org (`createdByOrgId === orgId`), it is deleted as today.

- [ ] **Step 1: Write the failing tests.**
  - `org-repository.test.ts`:
    - `cannot replace or delete a child enrolled only with another org`: seed child c4 enrolled only in o2. `forOrg("o1").applyWrites` upserting c4 rejects, and so does removing c4. c4 is unchanged.
    - `may write a child when the same batch enrolls it here`.
  - `registration-repository.test.ts`:
    - `public viewer gets no players but correct seatCounts`: sample `session-2026-01` has 10 players → `seatCounts["session-2026-01"] === 10` and `players` is `[]`.
    - `parent viewer sees only their own children`: `user-1` → ids `["player-child-1","player-child-2"]`.
    - `admin viewer sees the org roster only`: a child created by another org, with no enrollment here, is absent.
    - `first registration of a parent's child succeeds` (Review Focus 2): `enrollPaidInDb(DEFAULT_ORG_ID, "player-child-1", "program-summer-2026", "clinic-summer-2026-w1")` succeeds.
    - `deleting a parent's child only removes this org's enrollments` (Review Focus 3): after delete, the child doc still exists, the parent viewer still sees the child, and the admin viewer doesn't.
    - `unknown org is rejected`: `getStateForViewer("org-missing", {kind:"public"})` rejects with `ORG_NOT_FOUND`.
- [ ] **Step 2: Run** the two test files. Expect FAIL.
- [ ] **Step 3: Implement.** Pass `DEFAULT_ORG_ID` at the existing route call sites so routes compile; Task 5 replaces those routes. Update existing tests for the new parameter order.
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit`. Expect a pass.
- [ ] **Step 5: Commit** with the message `Scope registration state to an organization and its viewer`.

### Task 3: Platform and family repositories

**Files:**
- Create: `lib/db/platform-repository.ts`, `lib/db/family-repository.ts`
- Test: `__tests__/platform-repository.test.ts`, `__tests__/family-repository.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // platform-repository.ts — creates the default org doc if absent before reading
  export function getOrganizationBySlug(slug: string): Promise<Organization | null>;
  export function getOrganizationById(id: string): Promise<Organization | null>;
  export function listLiveOrganizations(): Promise<Organization[]>; // status "live", sorted by name
  // family-repository.ts
  export function childrenForParent(parentUserId: string): Promise<Child[]>;
  export function addChild(parentUserId: string, parentEmail: string, input: ChildInput): Promise<{ child: Child } | { error: string }>;
  /** Live orgs where any of the parent's children has a non-removed enrollment. */
  export function organizationsForParent(parentUserId: string): Promise<Organization[]>;
  ```
- `addChild` validates with `validateChildInput`. It creates id `player-${crypto.randomUUID()}`, `email` = lowercased parent email, `parentUserId`, and the same dicebear `avatarUrl` format as `addChildForParent` in `lib/player-store.ts`. There is no `createdByOrgId`. It writes through `store.insertOne("children", …)`.

- [ ] **Step 1: Write the failing tests** (memory store):
  - Slug and id lookups find the default org; an unknown slug gives `null`.
  - `listLiveOrganizations` excludes `draft` and `suspended` orgs.
  - `addChild` rejects an empty name with `"Name is required."`.
  - `addChild` then `childrenForParent` returns the new child.
  - `organizationsForParent` lists o1 when one of the parent's children is enrolled there. It excludes o2 when that child's only o2 enrollment is `removed`.
- [ ] **Step 2: Run.** Expect FAIL. **Step 3: Implement.** **Step 4: Run.** Expect PASS.
- [ ] **Step 5: Commit** with the message `Add platform and family repositories`.

### Task 4: Org state and account read APIs

**Files:**
- Create: `lib/api-viewer.ts`, `app/api/orgs/[orgId]/state/route.ts`, `app/api/account/route.ts`, `app/api/account/children/route.ts`
- Test: `__tests__/api-org-read.test.ts`

**Interfaces:**
- Consumes: `getStateForViewer`, `Viewer`, `ORG_NOT_FOUND` (Task 2); platform and family repositories (Task 3); `getUserForSession` and `readSessionToken` (`lib/db/auth-repository.ts`).
- Produces:
  ```ts
  // lib/api-viewer.ts
  export function resolveViewer(request: Request): Promise<{ user: AuthUser | null; viewer: Viewer }>; // admin role → admin; signed in → parent; else public
  export function requireLiveOrg(orgId: string): Promise<{ org: Organization; error?: undefined } | { org?: undefined; error: NextResponse }>; // 404 unless status is live
  export function orgNotFound(): NextResponse; // 404 { error: "Organization not found." }
  ```
  - `GET /api/orgs/[orgId]/state` → `{ state }` from `getStateForViewer`.
  - `GET /api/account` (signed in, else 401 `{ error: "Sign in required." }`) → `{ children: Child[]; organizations: { organization: { id, slug, name }; state: AppState }[] }`. Each entry's `state` is `getStateForViewer(org.id, { kind: "parent", userId })`.
  - `POST /api/account/children` (signed in) takes `{ name, grade, level }` and calls `addChild` with the **session user's** id and email, ignoring any ids in the body. It returns `{ child }`, or 400 `{ error }`.
- Route tests call the exported handlers directly with `new Request(...)`. For signed-in requests, create a session with `createSession(userId)` and send `cookie: buildSessionCookie(token)` (`lib/db/auth-repository.ts`).

- [ ] **Step 1: Write the failing tests** (`api-org-read.test.ts`):
  - `public state has no players and has seat counts` (Review Focus 1). `JSON.stringify(body)` contains no sample player email, e.g. `"alex.johnson@example.com"`.
  - `parent state contains only their children`.
  - `admin state contains the roster`.
  - `unknown org is 404` and `suspended org is 404`: seed a suspended org doc.
  - `account requires sign-in` (401), and `account lists the default org for user-1` (who has an enrollment there).
  - `adding a child uses the session user, not the body`: the body carries `parentUserId: "someone-else"`, and the stored child's `parentUserId` is `"user-1"`.
- [ ] **Step 2: Run.** Expect FAIL. **Step 3: Implement.** **Step 4: Run.** Expect PASS, and `npx tsc --noEmit` is clean.
- [ ] **Step 5: Commit** with the message `Serve org state and family accounts by viewer`.

### Task 5: Org-scoped mutation APIs; retire global routes

**Files:**
- Create under `app/api/orgs/[orgId]/`:
  - `programs/route.ts` (POST)
  - `programs/[programId]/route.ts` (PATCH)
  - `programs/[programId]/players/[playerId]/remove/route.ts` (POST)
  - `clinics/route.ts` (POST)
  - `clinics/[clinicId]/route.ts` (PATCH, DELETE)
  - `players/route.ts` (POST)
  - `players/[playerId]/route.ts` (PATCH, DELETE)
  - `players/[playerId]/payment-link/route.ts` (POST)
  - `registrations/enroll/route.ts` (POST)
- Modify: `app/api/stripe/create-payment-intent/route.ts`, `app/api/stripe/confirm-enrollment/route.ts`, `app/api/stripe/webhook/route.ts`, `lib/stripe.ts` (metadata)
- Delete:
  - `app/api/state/`
  - `app/api/programs/`
  - `app/api/clinics/`
  - `app/api/players/`, including `children/`
  - `app/api/registrations/`
- Test: `__tests__/api-org-write.test.ts`, extend the stripe tests in `__tests__/stripe.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Each new route:
  1. Runs `requireLiveOrg(orgId)`.
  2. Authorizes:
     - Every route except enroll runs `requireAdmin`. That newly adds auth to players POST, PATCH and DELETE, and to payment-link, which previously had none.
     - Enroll needs a signed-in parent who owns the child (`player.parentUserId === user.id`), or an admin. Otherwise it returns 404 `{ error: "Player not found." }`.
  3. Calls the Task 2 `*InDb(orgId, …)` function, then responds `{ state: await getStateForViewer(orgId, viewer) }`. Domain errors keep today's 400 `{ error }`.
- Request bodies and validation are the same as the old routes. Move the code; don't rewrite it.
- Stripe:
  - `create-payment-intent` and `confirm-enrollment` require `orgId` in the body and run `requireLiveOrg`.
  - `buildPaymentIntentMetadata` gains `orgId`.
  - The webhook resolves `orgId = metadata.orgId ?? DEFAULT_ORG_ID` and loads that org's state.

- [ ] **Step 1: Write the failing tests:**
  - **Isolation suite.** Seed the default org (sample data) plus org `org-b`: one program, one clinic, one parentless child `b-child` (created by org-b) enrolled there. As admin, calling each default-org route with org-b's record ids returns a 4xx error and leaves org-b's docs deep-equal to before. Cover:
    - program PATCH
    - clinic PATCH and DELETE
    - player PATCH and DELETE (`b-child`)
    - payment-link
    - remove-from-program
  - `player routes now require admin` → 401 for a public request.
  - `enroll rejects another parent's child` → 404.
  - `old global state route is gone`: the module `@/app/api/state/route` no longer exists (assert with `fs.existsSync` on the file path).
  - `webhook falls back to the default org without metadata.orgId` (Review Focus 5). Mirror the existing stripe test setup.
  - `payment intent metadata includes orgId`.
- [ ] **Step 2: Run.** Expect FAIL. **Step 3: Implement** and delete the old routes. **Step 4: Run** `npx vitest run` and `npx tsc --noEmit`. Expect PASS.
- [ ] **Step 5: Commit** with the message `Move registration APIs under organizations`.

### Task 6: Org-aware client data layer

**Files:**
- Create: `components/org-provider.tsx`
- Modify: `lib/registration-api.ts`, `lib/use-player-store.ts`, `components/registration-provider.tsx`, `components/app-shell.tsx` (pass `orgId={DEFAULT_ORG_ID}` for now, so the old pages keep working; Task 7 removes it from the shell)
- Test: `__tests__/registration-api.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // components/org-provider.tsx
  export type OrgSummary = { id: string; slug: string; name: string };
  export function OrgProvider(props: { org: OrgSummary; children: React.ReactNode }): JSX.Element;
  export function useOrg(): OrgSummary;            // throws outside OrgProvider
  export function useOrgHref(): (path: string) => string; // "/programs" → "/o/<slug>/programs"; "/" → "/o/<slug>"
  // lib/registration-api.ts — every function takes orgId first, e.g.:
  export function fetchRegistrationState(orgId: string): Promise<AppState>; // GET /api/orgs/<orgId>/state
  export function apiAddChild(input: ChildInput): Promise<{ child?: Child; error?: string }>; // POST /api/account/children
  // usePlayerStore(orgId: string); RegistrationProvider({ orgId, children })
  ```
  - `stripe` client calls in `registration-review.tsx` send `orgId` from `useOrg()`.
  - `addChild` in the store posts to `/api/account/children` and then `refresh()`es the org state.

- [ ] **Step 1: Write the failing tests:**
  - Mock `fetch`: `fetchRegistrationState("org-x")` requests `/api/orgs/org-x/state`.
  - `apiCreateProgram("org-x", input)` POSTs to `/api/orgs/org-x/programs`.
  - `apiAddChild` POSTs to `/api/account/children` with no parent ids in the body.
- [ ] **Step 2: Run.** Expect FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run` and `npx tsc --noEmit`. Type errors in pages are expected until Task 7, so keep the old pages compiling by passing `DEFAULT_ORG_ID` temporarily.
- [ ] **Step 5: Commit** with the message `Load registration state per organization on the client`.

### Task 7: Organization pages under `/o/[slug]`

**Files:**
- Create:
  - `app/o/[slug]/layout.tsx`, a server component. It runs `getOrganizationBySlug`, calls `notFound()` if the org is missing or not `live`, and wraps children in `OrgProvider` plus `RegistrationProvider orgId`.
  - Pages under `app/o/[slug]/`, each rendering the existing component:
    - `page.tsx` → `HomeContent`
    - `programs/page.tsx`
    - `clinics/page.tsx`
    - `showcases/page.tsx`
    - `admin/page.tsx` (from `app/dashboard/page.tsx`)
    - `admin/programs/new/page.tsx`
    - `admin/programs/[programId]/page.tsx`
    - `register/page.tsx`, which renders `ParentProgramRegistration` with the same signed-in guard `/player` uses
    - `register/[playerId]/[clinicId]/page.tsx` → `RegistrationReview`
- Delete:
  - `app/programs/`
  - `app/clinics/`
  - `app/showcases/`
  - `app/dashboard/`
  - `app/player/registration/`
- Modify, replacing every hardcoded org link found by the Phase 2 grep with `useOrgHref()`:
  - `components/home-content.tsx`
  - `clinics-content.tsx`
  - `showcases-content.tsx`
  - `admin-schedule-availability.tsx`
  - `new-program-form.tsx`
  - `program-detail-page.tsx`
  - `parent-program-registration.tsx`: push `register/<child>/<clinic>`.
  - `registration-review.tsx`: links back to `/account`; the admin redirect goes to `admin`.
  - `summer-2027-programs.tsx`: `/login?next=/account`.
  - `site-header.tsx`: org nav inside an org, platform nav outside it.
  - `lib/nav.ts`: becomes `orgNavLinks(slug)` (Home, Programs, Clinics) plus `PLATFORM_NAV_LINKS` (Home `/`, About `/about`).
  - `lib/auth.ts`: `getPostLoginPath` sends admins to `/o/shifty-player/admin` (built from `DEFAULT_ORG_SLUG`) and parents to `/account`.
- `components/app-shell.tsx`: remove `RegistrationProvider`; it now lives only in the org layout.
- `site-header.tsx`: the account-menu dashboard link uses `getPostLoginPath(user)`.
- Leave the "Shifty Player Platform" section in `home-content.tsx`; Task 8 moves it.
- Test: update `__tests__/auth.test.ts` for `getPostLoginPath`. Run `npm run build` as the page-level check.

- [ ] **Step 1: Update `auth.test.ts` expectations** (admin → `/o/shifty-player/admin`, user → `/account`) and run it. Expect FAIL.
- [ ] **Step 2: Implement** the layout, pages, link changes and deletions.
- [ ] **Step 3: Verify.** `npx vitest run`, `npx tsc --noEmit` and `npm run build` succeed. `grep -rnE '"/(programs|clinics|showcases|dashboard|player)' components app lib` returns no matches.
- [ ] **Step 4: Commit** with the message `Serve each organization under /o/[slug]`.

### Task 8: `/account`, platform landing page, redirects

**Files:**
- Create:
  - `app/account/page.tsx` (from `app/player/page.tsx`)
  - `components/platform-home.tsx`, a client component taking `organizations: OrgSummary[]`
  - Replace `app/page.tsx` with a server component that loads `listLiveOrganizations()` and renders `PlatformHome`.
- Modify:
  - `components/parent-children-overview.tsx`: props become `{ childrenPlayers: Player[]; programs: Program[]; sessions: Session[] }` instead of `useRegistration()`.
  - `next.config.ts`: add `async redirects()`.
- Delete: `app/player/`
- Test: `__tests__/redirects.test.ts`

**Interfaces / content:**
- **`/account`:**
  - Guarded as `/player` was: no user → `/`, admin → their admin page.
  - Fetches `GET /api/account`.
  - Per organization: a section headed with the org name, with `ParentChildrenOverview` and `ActiveProgramsSection` fed from that org's `state`, and a "Register for programs" link to `/o/<slug>/register`.
  - If there are no organizations: "You haven't registered with an organization yet" with a link to `/`.
  - Keeps the completed-programs history section and stat tiles as on `/player`.
- **`/` (PlatformHome):**
  - Hero: title "Shifty Player Platform", subtitle "Run registrations, rosters and payments for your basketball organization."
  - The four feature cards, moved here: remove `PLATFORM_FEATURES` and its section from `home-content.tsx`.
  - "Organizations" section: one card per live org linking to `/o/<slug>`.
  - Uses brand tokens.
- **Redirects (`permanent: false`):**

  | Source | Destination |
  | --- | --- |
  | `/programs` | `/o/shifty-player/programs` |
  | `/clinics` | `/o/shifty-player/clinics` |
  | `/showcases` | `/o/shifty-player/showcases` |
  | `/dashboard` | `/o/shifty-player/admin` |
  | `/dashboard/programs/:path*` | `/o/shifty-player/admin/programs/:path*` |
  | `/player` | `/account` |
  | `/player/registration/:playerId/:clinicId` | `/o/shifty-player/register/:playerId/:clinicId` |

- [ ] **Step 1: Write the failing test.** `redirects.test.ts` imports `next.config.ts`, awaits `redirects()`, and asserts the exact table above, with every `permanent` set to `false`.
- [ ] **Step 2: Run.** Expect FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run`, `npx tsc --noEmit` and `npm run build`. Expect PASS.
- [ ] **Step 5: Commit** with the message `Add family account page, platform landing page and legacy redirects`.

### Task 9: End-to-end update and Phase 2 verification

**Files:**
- Modify: `e2e/registration.spec.ts` (new URLs: `/o/shifty-player/programs`, `/o/shifty-player/admin…`, `/account`, `/login?next=/account`)
- Create: `e2e/org-routing.spec.ts`
- Modify: `README.md` (one short "Organization URLs" note under Getting Started)

- [ ] **Step 1: Write `org-routing.spec.ts`:**
  - `/` shows the "Shifty Player" org card, which links to `/o/shifty-player`.
  - `/o/does-not-exist` shows the 404 page.
  - Each of `/dashboard/programs/program-winter-2026` (as admin), `/player` (as parent) and `/programs` ends on its new URL (Review Focus 4).
  - A public `GET /api/orgs/org-shifty-player/state` response has `players` of length 0.
- [ ] **Step 2: Update `registration.spec.ts` URLs and run** `npm run test:e2e`. Expect all specs to pass.
- [ ] **Step 3: Full verification.** `npx vitest run`, `npx tsc --noEmit`, `npx eslint` (no new errors beyond the 4 pre-existing `react-hooks/set-state-in-effect`) and `npm run build`.
- [ ] **Step 4: Commit** with the message `Cover organization routing end to end`.

---

## Phase 3 and later

Unchanged from the Phase 1 plan's outlines. Phase 3 replaces the global `admin` role with `memberships`, `requireOrgRole`, `/signup/org` and `/platform`.
