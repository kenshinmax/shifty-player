# Multi-organization Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Shifty Player's data so every program, clinic, enrollment and order belongs to an organization, then (in later phases) add per-org routing, org sign-up and roles, and Stripe Connect.

**Architecture:** Phase 1 replaces the rewrite-everything persistence in `lib/db/registration-repository.ts` with a small `DocStore` (memory + Mongo), new `children` / `enrollments` / `orders` collections, and an org-scoped `forOrg(orgId)` repository. A pure legacy adapter converts between today's `AppState` and the new documents, so every existing route, provider and component keeps working unchanged against the single `shifty-player` organization. Mutations still run today's pure `player-store` functions; the repository diffs the before/after documents and writes only the records that changed.

**Tech Stack:** Next.js 16.3 (App Router), TypeScript, MongoDB node driver, Vitest (jsdom), Playwright, `tsx` (new dev dependency, for the migration script).

**Spec:** `docs/superpowers/specs/2026-10-19-multi-organization-design.md`

## Global Constraints

- Every org-owned document carries `orgId`; all org-owned reads and writes filter on it.
- Default organization: id `org-shifty-player`, slug `shifty-player`, name `Shifty Player`, status `live`, `hubspotEnabled: true`, `stripeChargesEnabled: false`, `platformFeeBps: 0`.
- Collections: `organizations`, `programs`, `sessions`, `children`, `enrollments`, `orders`, `processed_payments`; legacy `players` is archived to `players_legacy` by the migration.
- Enrollment ids are deterministic: `enr-${childId}-${sessionId}`. Migrated order ids: `ord-${childId}-${sessionId}`.
- Removing an enrollment sets `status: "removed"`; it is never deleted. Orders are never deleted or updated by the diff (financial history).
- Phase 1 changes no route, provider, component or URL. Exported function names and signatures of `lib/db/registration-repository.ts` stay the same.
- Unit tests use the memory store only. Never run the migration script, or a dev server that reads `.env.local`, against the real Mongo database while implementing; that is a deploy step for the user.
- AGENTS.md: before writing Next.js route or page code (Phase 2+), read the relevant guide in `node_modules/next/dist/docs/`.
- Node lives at `/opt/homebrew/bin`; prefix commands with `export PATH=/opt/homebrew/bin:$PATH &&` if `node` is not found.

## Review Focus

1. **Deploying Phase 1 onto a database that still has legacy `players`** — the app must refuse to start serving registration data with a clear "run `npm run migrate:orgs`" error, not auto-seed sample data on top of real data. (Test in Task 5.)
2. **Re-enrolling after removal** — a child removed from a program and then registered again for the same clinic reuses id `enr-<child>-<clinic>`; the record must flip back from `removed` to active, not fail a unique index. (Test in Task 3 and Task 5.)
3. **Deleting a player who has paid orders** — the child and their enrollments go, but the order documents stay. (Test in Task 3.)
4. **Re-running the migration** (after success, or after a crash midway) — no duplicates, counts unchanged, paid statuses preserved. (Test in Task 6.)
5. **Tuition-only paid enrollment (no swag order)** — `enrollPaidInDb` must store `status: "paid"`, and a later unrelated mutation must not revert it to `pending`. (Test in Task 5.)

---

## Phase 1 — Data layer (detailed)

### File structure

| File | Responsibility |
| --- | --- |
| `lib/types.ts` (modify) | Add `Organization`, `OrgProgram`, `OrgSession`, `Child`, `Enrollment`, `Order` types |
| `lib/organizations.ts` (create) | `DEFAULT_ORG_ID`, `DEFAULT_ORG_SLUG`, `defaultOrganization()` |
| `lib/db/doc-store.ts` (create) | `DocStore` interface; memory and Mongo implementations; singleton accessor |
| `lib/db/legacy-state.ts` (create) | Pure `AppState` ⇄ org documents conversion, `enrollmentId()` |
| `lib/db/org-diff.ts` (create) | Pure diff of two `OrgDocuments` into write operations |
| `lib/db/org-repository.ts` (create) | `forOrg(orgId)`: org-scoped reads, `applyWrites`, `markEnrollmentPaid`, `roster` |
| `lib/db/registration-repository.ts` (rewrite internals) | Same exports; built on the above |
| `lib/db/migrate-to-orgs.ts` (create) | Idempotent `migrateToOrganizations(store)` |
| `scripts/migrate-to-orgs.ts` (create) | CLI wrapper around the migration |
| `__tests__/doc-store.test.ts`, `legacy-state.test.ts`, `org-diff.test.ts`, `org-repository.test.ts`, `migrate-to-orgs.test.ts`, `api-route-boundaries.test.ts` (create) | Unit tests |
| `__tests__/registration-repository.test.ts` (extend) | Behavior parity + targeted-write tests |

### Task 1: Org types and DocStore

**Files:**
- Modify: `lib/types.ts` (append)
- Create: `lib/organizations.ts`, `lib/db/doc-store.ts`
- Test: `__tests__/doc-store.test.ts`

**Interfaces:**
- Produces (`lib/types.ts`):
  ```ts
  export type OrganizationStatus = "draft" | "pending_review" | "live" | "suspended";
  export type Organization = {
    id: string; slug: string; name: string; logoUrl?: string;
    status: OrganizationStatus;
    stripeAccountId?: string; stripeChargesEnabled: boolean;
    platformFeeBps: number; hubspotEnabled: boolean;
    createdAt: string; approvedAt?: string;
  };
  export type OrgProgram = Program & { orgId: string };
  export type OrgSession = Session & { orgId: string };
  /** A parent's child (or an org-added roster player). Not owned by an org. */
  export type Child = {
    id: string; parentUserId?: string; createdByOrgId?: string;
    name: string; email: string; grade: string; level: Level; avatarUrl?: string;
  };
  export type EnrollmentStatus = "pending" | "paid" | "removed";
  export type Enrollment = {
    id: string; orgId: string; childId: string; programId: string; sessionId: string;
    status: EnrollmentStatus; paidAt?: string; stripePaymentIntentId?: string;
    paymentLinkSentAt?: string; createdAt: string;
  };
  export type OrderItem = NonNullable<Player["merchandiseOrder"]>["items"][number];
  export type Order = {
    id: string; orgId: string; parentUserId?: string; childId: string; sessionId: string;
    items: OrderItem[]; tuitionCents: number; swagCents: number; totalCents: number;
    platformFeeCents: number; stripePaymentIntentId?: string; paidAt: string;
  };
  ```
- Produces (`lib/organizations.ts`): `DEFAULT_ORG_ID = "org-shifty-player"`, `DEFAULT_ORG_SLUG = "shifty-player"`, `defaultOrganization(now?: string): Organization` (values from Global Constraints; `createdAt = now ?? new Date().toISOString()`).
- Produces (`lib/db/doc-store.ts`):
  ```ts
  export type CollectionName = "organizations" | "programs" | "sessions" | "children"
    | "enrollments" | "orders" | "processed_payments" | "players" | "players_legacy";
  export type FilterValue = string | number | boolean
    | { $in: readonly (string | number)[] } | { $exists: boolean };
  export type Filter = Record<string, FilterValue>;
  export interface DocStore {
    find<T extends object>(c: CollectionName, filter?: Filter): Promise<T[]>;
    findOne<T extends object>(c: CollectionName, filter: Filter): Promise<T | null>;
    count(c: CollectionName, filter?: Filter): Promise<number>;
    /** false when the unique key already exists. */
    insertOne<T extends object>(c: CollectionName, doc: T): Promise<boolean>;
    /** Upsert by filter; throws on unique-key conflict with a non-matching doc. */
    replaceOne<T extends object>(c: CollectionName, filter: Filter, doc: T): Promise<void>;
    updateMany(c: CollectionName, filter: Filter, set: Record<string, unknown>): Promise<number>;
    deleteMany(c: CollectionName, filter?: Filter): Promise<number>;
  }
  export type MemorySeed = Partial<Record<CollectionName, object[]>>;
  export function createMemoryStore(seed?: MemorySeed): DocStore;
  export function createMongoStore(getDb: () => Promise<import("mongodb").Db>): DocStore;
  /** Memory store when MONGODB_URI is unset, Mongo store otherwise. */
  export function getDocStore(): DocStore;
  /** Replace the process-wide memory store's contents (tests / seed). Sync. */
  export function resetMemoryStore(seed?: MemorySeed): void;
  ```
  Unique key per collection: `paymentIntentId` for `processed_payments`, `id` for all others. Memory `find` returns `structuredClone`d docs in insertion order; `replaceOne` on an existing doc keeps its position. Mongo `find` uses projection `{ _id: 0 }`; the Mongo store lazily creates unique indexes on first use (`{id:1}` per collection, `{paymentIntentId:1}` for processed payments, plus `{orgId:1, id:1}` on programs, sessions, enrollments, orders); `insertOne` maps error code 11000 to `false`.

- [ ] **Step 1: Write failing tests** in `__tests__/doc-store.test.ts` against `createMemoryStore()`:
  - `find filters by equality, $in and $exists` — seed `programs` with `{id:"a",orgId:"o1"}`, `{id:"b",orgId:"o2"}`, `{id:"c"}`; `find(…,{orgId:"o1"})` → ids `["a"]`; `{id:{$in:["a","c"]}}` → `["a","c"]`; `{orgId:{$exists:false}}` → `["c"]`.
  - `returned docs are copies` — mutate a found doc, re-find, original unchanged.
  - `insertOne returns false on duplicate unique key` — `processed_payments` `{paymentIntentId:"pi_1"}` twice → `true`, then `false`.
  - `replaceOne upserts and keeps position` — seed ids a,b; replace b with `{id:"b",x:1}`, insert z via `replaceOne(…,{id:"z"},…)`; `find` ids → `["a","b","z"]`, b has `x:1`.
  - `replaceOne throws when id exists outside the filter` — seed `{id:"a",orgId:"o1"}`; `replaceOne("programs",{orgId:"o2",id:"a"},{id:"a",orgId:"o2"})` rejects.
  - `updateMany and deleteMany return counts`.
  - `resetMemoryStore replaces getDocStore contents` — with `MONGODB_URI` unset, `resetMemoryStore({programs:[{id:"x"}]})` then `getDocStore().count("programs")` → 1.
- [ ] **Step 2: Run** `npx vitest run __tests__/doc-store.test.ts` — expect FAIL (module not found).
- [ ] **Step 3: Implement** the types, `lib/organizations.ts` and `lib/db/doc-store.ts`. The Mongo store wraps `getDb` from `lib/mongo.ts`; it is not unit-tested (no Mongo in tests).
- [ ] **Step 4: Run** the test file — expect PASS. Run `npx tsc --noEmit` — expect no errors.
- [ ] **Step 5: Commit** `git add lib/types.ts lib/organizations.ts lib/db/doc-store.ts __tests__/doc-store.test.ts && git commit -m "Add organization types and a minimal document store"`

### Task 2: Legacy state adapter

**Files:**
- Create: `lib/db/legacy-state.ts`
- Test: `__tests__/legacy-state.test.ts`

**Interfaces:**
- Consumes: types from Task 1; `normalizeRegistrationState` from `lib/storage.ts`.
- Produces:
  ```ts
  export type OrgDocuments = {
    programs: OrgProgram[]; sessions: OrgSession[]; children: Child[];
    /** Active (non-removed) enrollments only. */
    enrollments: Enrollment[]; orders: Order[];
  };
  export function enrollmentId(childId: string, sessionId: string): string; // `enr-${childId}-${sessionId}`
  export function splitLegacyState(
    state: AppState, orgId: string,
    existing?: OrgDocuments, now?: string,
  ): OrgDocuments;
  export function assembleLegacyState(docs: OrgDocuments): AppState;
  ```
- Split rules:
  - Programs and sessions get `orgId`.
  - Each player becomes a child with the same `id`. Set `createdByOrgId = orgId` only when `parentUserId` is absent. Omit undefined optional keys.
  - One enrollment per `sessionId` whose session exists in `state.sessions` (unknown session ids are dropped). `programId` comes from the session. `paymentLinkSentAt` is the player's value.
  - If `existing` has an enrollment with the same id, carry over its `status`, `paidAt`, `stripePaymentIntentId` and `createdAt`. Otherwise `createdAt = now`, and the status is `paid` (with `paidAt = merchandiseOrder.paidAt`) when `merchandiseOrder?.clinicId === sessionId`, else `pending`.
  - A `merchandiseOrder` becomes an order with id `ord-${playerId}-${clinicId}` and `platformFeeCents: 0`, unless `existing.orders` already holds an order for the same `childId` + `sessionId` + `paidAt`, in which case that order is reused as-is.
- Assemble rules:
  - `players` = one per child, in children order.
  - `sessionIds` = enrollment `sessionId`s in enrollment order; `programIds` = distinct `programId`s of those enrollments, in first-seen order.
  - `paymentLinkSentAt` = the latest of the child's enrollments' values.
  - `merchandiseOrder` = the child's order with the latest `paidAt`, mapped back to `{clinicId: sessionId, items, tuitionCents, swagCents, totalCents, paidAt}`.
  - Strip `orgId` and `createdByOrgId`. Return through `normalizeRegistrationState`.

- [ ] **Step 1: Write failing tests:**
  - `round-trips sample data` — `assembleLegacyState(splitLegacyState(normalizeRegistrationState(sampleData), "org-x", undefined, "2026-01-01T00:00:00.000Z"))` deep-equals `normalizeRegistrationState(sampleData)`.
  - `stamps orgId on programs, sessions, enrollments and orders`.
  - `child without parent is created by the org` — `player-1` → `createdByOrgId: "org-x"`; `player-child-1` → no `createdByOrgId`, `parentUserId: "user-1"`.
  - `enrollment ids are deterministic` — `player-1` + `session-2026-01` → id `enr-player-1-session-2026-01`.
  - `order clinic marks enrollment paid` — player with `merchandiseOrder.clinicId: "clinic-summer-2026-w1"` and that session → that enrollment `status: "paid"`, `paidAt` equal to the order's `paidAt`; their other enrollments `pending`.
  - `existing enrollment fields are preserved` — pass `existing` containing that enrollment with `status: "paid"`, `stripePaymentIntentId: "pi_9"`, `createdAt: "2020-01-01T00:00:00.000Z"`; the result keeps all three even though the player has no `merchandiseOrder`.
  - `drops sessionIds whose session does not exist`.
- [ ] **Step 2: Run** `npx vitest run __tests__/legacy-state.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `lib/db/legacy-state.ts` per the rules above.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `git commit -m "Convert registration state to org documents and back"` (add both files).

### Task 3: Document diff

**Files:**
- Create: `lib/db/org-diff.ts`
- Test: `__tests__/org-diff.test.ts`

**Interfaces:**
- Consumes: `OrgDocuments` (Task 2).
- Produces:
  ```ts
  type Changes<T> = { upsert: T[]; remove: string[] };
  export type OrgWriteOps = {
    programs: Changes<OrgProgram>; sessions: Changes<OrgSession>;
    children: Changes<Child>;
    /** remove → set status "removed" (never deleted). */
    enrollments: Changes<Enrollment>;
    /** Orders are append-only: only new or changed ids, never removed. */
    orders: { upsert: Order[] };
  };
  export function diffOrgDocuments(before: OrgDocuments, after: OrgDocuments): OrgWriteOps;
  export function isEmptyWriteOps(ops: OrgWriteOps): boolean;
  ```
  "Changed" means not deep-equal (compare with a key-order-independent equality; `JSON.stringify` of a key-sorted copy is fine).

- [ ] **Step 1: Write failing tests:**
  - `no changes yields empty ops` — the same documents twice → `isEmptyWriteOps` is `true`.
  - `updated program is upserted, others untouched` — change one program's `name` → `programs.upsert` has exactly that program; the other collections are empty.
  - `missing session is removed`, `new session is upserted`.
  - `dropped enrollment is listed for removal` — remove one enrollment from `after` → `enrollments.remove` is `[thatId]`.
  - `re-added enrollment is upserted` — `before` lacks `enr-c1-s1` and `after` has it → it appears in `enrollments.upsert` (the repository's upsert revives a `removed` record).
  - `orders are never removed` — `after` drops a child and its order → `children.remove` holds the child id, and the ops have no order removal (the type has no `remove` key for orders).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "Diff org documents into targeted writes"`.

### Task 4: Org-scoped repository

**Files:**
- Create: `lib/db/org-repository.ts`
- Test: `__tests__/org-repository.test.ts`

**Interfaces:**
- Consumes: `DocStore`, `getDocStore` (Task 1); `OrgDocuments` (Task 2); `OrgWriteOps` (Task 3).
- Produces:
  ```ts
  export type OrgRepository = {
    orgId: string;
    /** programs, sessions, active enrollments and orders of this org. */
    loadOrgDocuments(): Promise<Omit<OrgDocuments, "children">>;
    /** Children visible to this org: a non-removed enrollment here, or createdByOrgId === orgId. */
    roster(): Promise<Child[]>;
    applyWrites(ops: OrgWriteOps): Promise<void>;
    markEnrollmentPaid(id: string, paidAt: string, stripePaymentIntentId?: string): Promise<boolean>;
    /** Removes every org-owned doc of this org (programs, sessions, enrollments, orders). Seed only. */
    clearOrgDocuments(): Promise<void>;
  };
  export function forOrg(orgId: string, store?: DocStore): OrgRepository;
  ```
- `applyWrites` behavior:
  - Upserts use `replaceOne` with filter `{orgId, id}` for org-owned collections and `{id}` for children.
  - Removals delete by `{orgId, id: {$in}}` (children: `{id: {$in}}`, plus `updateMany` of their enrollments in this org to `status: "removed"`). Enrollment removal is `updateMany({orgId, id: {$in}}, {status: "removed"})`.
  - Every upserted org-owned doc must carry `orgId === this.orgId`; otherwise it throws `Error("Document belongs to another organization.")`.
  - Children are global (not org-owned). Phase 1 routes children writes through here; Phase 2 moves them to `family-repository`.

- [ ] **Step 1: Write failing tests** using `createMemoryStore` seeded with two orgs, `o1` and `o2`, each with one program, one session, one enrollment and one order:
  - `loadOrgDocuments returns only this org's docs and excludes removed enrollments`.
  - `applyWrites never touches the other org` — apply upserts and removals as `o1`, then deep-compare all `o2` docs to before.
  - `rejects a doc stamped with another orgId` — `forOrg("o1").applyWrites` with a program that has `orgId: "o2"` → rejects.
  - `cannot overwrite another org's record by id` — as `o1`, upsert a program whose `id` exists in `o2` → rejects (unique id).
  - `removing an enrollment marks it removed; upserting it again revives it`.
  - `roster applies the visibility rule` — children: c1 (enrolled in o1), c2 (enrolled in o1 but `removed`), c3 (`createdByOrgId: "o1"`, no enrollments), c4 (enrolled only in o2) → `forOrg("o1").roster()` ids are `["c1","c3"]`.
  - `markEnrollmentPaid sets status, paidAt and stripePaymentIntentId; false for an unknown id or another org's id`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "Add org-scoped repository"`.

### Task 5: Rebuild the registration repository on org documents

**Files:**
- Modify: `lib/db/registration-repository.ts` (internals only; keep every export and signature)
- Modify: `__tests__/registration-repository.test.ts` (keep existing tests; add new ones)
- Create: `__tests__/api-route-boundaries.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `defaultOrganization`, `DEFAULT_ORG_ID`; `sampleData`; the `player-store` pure functions (unchanged).
- Produces: unchanged public API: `getRegistrationState`, `seedRegistrationState`, `resetMemoryRegistrationDb`, all `*InDb` functions, `claimProcessedPayment`. New export: `LEGACY_DATA_ERROR` (string constant, below).

**Internal design (replace `readAppState` / `writeAppState` / `replaceCollectionById` / duplicate-repair):**
- `loadDocuments()`:
  - If `store.count("players") > 0`, throw `new Error(LEGACY_DATA_ERROR)`, where `LEGACY_DATA_ERROR = "Legacy registration data found. Run \`npm run migrate:orgs\` before starting the app."`.
  - Ensure the default organization doc exists (`insertOne`, ignore `false`).
  - Then `forOrg(DEFAULT_ORG_ID).loadOrgDocuments()` plus every child (`store.find("children")`). Phase 1 shows all children because the parent and admin UIs still read one global state; Phase 2 replaces this with `roster()` and the family repository.
  - If programs, sessions and children are all empty, seed `sampleData` (as today) and reload.
- `mutateAppState(mutator)`: keep `enqueueRegistrationWrite`. Run `before = loadDocuments()`, `state = assembleLegacyState(before)`, `next = mutator(state)`, `after = splitLegacyState(next, DEFAULT_ORG_ID, before)`, then `applyWrites(diffOrgDocuments(before, after))`. Return `{ state: assembleLegacyState(await loadDocuments()) }`.
- `enrollPaidInDb`: after the mutation succeeds, call `markEnrollmentPaid(enrollmentId(playerId, clinicId), paidAt)` when that enrollment isn't already `paid`. The existing "already enrolled" idempotency check stays as it is.
- `seedRegistrationState(state)`: run `clearOrgDocuments()`, `deleteMany("children")` and `deleteMany("processed_payments")`. Ensure the organization exists, then `applyWrites` of `diffOrgDocuments(EMPTY, splitLegacyState(state, DEFAULT_ORG_ID))`.
- `resetMemoryRegistrationDb(state)`: `resetMemoryStore({ organizations: [defaultOrganization()], ...splitLegacyState(normalized, DEFAULT_ORG_ID) })`. It must stay synchronous.
- `claimProcessedPayment`: `store.insertOne("processed_payments", { paymentIntentId, processedAt })`.
- `markPaymentLinkSentInDb`: if the player has no enrollments, return `{ error: "This player has no clinic registrations yet." }`. There is no enrollment to record the link on.

- [ ] **Step 1: Write failing tests** (add to `__tests__/registration-repository.test.ts`; `beforeEach` keeps `resetMemoryRegistrationDb(sampleData)`):
  - `mutations write only touched records` — spy on `getDocStore()`'s `replaceOne` (`vi.spyOn`). `setProgramOpenInDb("program-summer-2026", false)` → exactly 1 `replaceOne` call, targeting `programs`. Don't use `updateProgramInDb` here: a rename also relabels that program's clinics, by design.
  - `other organizations are untouched` — `resetMemoryStore` with the sample org docs plus an `org-b` program, session, enrollment and order. Run `createPlayerInDb`, `deleteClinicInDb`, `removePlayerFromProgramInDb` and `seedRegistrationState`. Afterwards the `org-b` docs deep-equal their originals.
  - `refuses to run on unmigrated data` — `resetMemoryStore({ players: [legacyPlayer] })` → `getRegistrationState()` rejects with `LEGACY_DATA_ERROR`.
  - `tuition-only paid enrollment stays paid` — `enrollPaidInDb` with no merchandise order. The stored enrollment has `status: "paid"`. Then `updateProgramInDb(...)` on any program, and the enrollment is still `paid`.
  - `re-registering after removal revives the enrollment` — enroll, `removePlayerFromProgramInDb`, enroll again in the same clinic → it succeeds, there is one enrollment doc with that id, and its status is not `removed`.
  - `deleting a player keeps their orders` — enroll with a merchandise order, `deletePlayerInDb` → `orders` count unchanged; `children` and active enrollments for that player are gone.
  - `payment link requires a registration` — `markPaymentLinkSentInDb("player-child-1")` (no sessions in sample) → `{ error: "This player has no clinic registrations yet." }`.
- [ ] **Step 2: Write `__tests__/api-route-boundaries.test.ts`:** `no API route touches the database directly`. Glob `app/api/**/*.ts` with `fs` and assert that no file contains `@/lib/mongo`, `getDb(`, `.collection(` or `@/lib/db/doc-store`.
- [ ] **Step 3: Run** `npx vitest run __tests__/registration-repository.test.ts __tests__/api-route-boundaries.test.ts`. Expect the new repository tests to FAIL and the boundary test to PASS (routes already comply; it guards the future).
- [ ] **Step 4: Rewrite the internals** per the design above. Delete the now-unused `replaceCollectionById`, `ensureUniqueIdIndexes`, duplicate-repair and `MemoryDb` code.
- [ ] **Step 5: Run the whole unit suite** `npx vitest run` — expect all PASS. That includes the old repository and players-table tests unchanged.
- [ ] **Step 6: Commit** `git commit -m "Store registrations per organization with targeted writes"`.

### Task 6: Migration

**Files:**
- Create: `lib/db/migrate-to-orgs.ts`, `scripts/migrate-to-orgs.ts`
- Modify: `package.json` (add devDependency `tsx`; script `"migrate:orgs": "tsx --env-file=.env.local scripts/migrate-to-orgs.ts"`)
- Test: `__tests__/migrate-to-orgs.test.ts`

**Interfaces:**
- Consumes: `DocStore`, `splitLegacyState`, `diffOrgDocuments`, `forOrg`, `defaultOrganization`.
- Produces:
  ```ts
  export type MigrationReport = {
    organizationCreated: boolean; programsStamped: number; sessionsStamped: number;
    children: number; enrollments: number; orders: number; legacyPlayersArchived: number;
  };
  export async function migrateToOrganizations(store: DocStore, now?: string): Promise<MigrationReport>;
  ```
- Steps, in order:
  1. Insert the default organization if it's missing.
  2. `updateMany` programs and sessions where `orgId` is `$exists: false`, setting `orgId: DEFAULT_ORG_ID`.
  3. Read `players`. Run `splitLegacyState({programs, sessions, players}, DEFAULT_ORG_ID, existingOrgDocs, now)`, then apply the diff against `existingOrgDocs` (which makes reruns no-ops).
  4. Verify: every player id exists in `children`, and the count of active enrollments for those children equals the number of valid `sessionIds`. If not, throw `Error("Migration verification failed: …")` before archiving.
  5. Copy each player to `players_legacy` (`replaceOne` by id), then `deleteMany("players")`.
- `scripts/migrate-to-orgs.ts`:
  - Exits 1 with a message if `MONGODB_URI` is unset.
  - Otherwise runs the migration with `createMongoStore(getDb)`, prints the report as JSON, and closes the Mongo client.

- [ ] **Step 1: Write failing tests** (memory store seeded in the legacy shape: `programs` and `sessions` without `orgId`, `players` = `sampleData.players` plus one player with a `merchandiseOrder`):
  - `migrates legacy data` — report counts match the seed. Children are 13 ids (the 12 sample players plus the added one), `players` is empty, `players_legacy` has 13. Every program and session has `orgId: "org-shifty-player"`. The merchandise player's enrollment is `paid`, and there is 1 order.
  - `is idempotent` — run twice; the second report has zero stamped and archived, and all collection counts are unchanged.
  - `resumes after a partial run` — seed with programs already stamped and some children already present. The migration completes and leaves no duplicates.
  - `does not archive when verification fails` — use a store wrapper whose `replaceOne` for `children` silently skips one doc → rejects with "Migration verification failed", and `players` is still populated.
  - `after migration the app reads the same state` — the `getRegistrationState()` equivalent: `assembleLegacyState` of the migrated docs deep-equals `normalizeRegistrationState` of the legacy seed.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `lib/db/migrate-to-orgs.ts` and the script; `npm install -D tsx`. **Step 4: Run** — PASS.
- [ ] **Step 5: Smoke-check the script without Mongo:** `MONGODB_URI= npx tsx scripts/migrate-to-orgs.ts` should exit 1 with the "MONGODB_URI is not set" message. Do **not** run `npm run migrate:orgs` (it reads `.env.local`, which is the real database).
- [ ] **Step 6: Commit** `git commit -m "Add migration from legacy players to organization documents"`.

### Task 7: Phase 1 verification

- [ ] **Step 1:** `npx vitest run` — all PASS.
- [ ] **Step 2:** `npx eslint` and `npx tsc --noEmit` — no errors.
- [ ] **Step 3:** `npm run build` — succeeds.
- [ ] **Step 4:** `npm run test:e2e` — all PASS. This is safe in place: Playwright blanks the Mongo, HubSpot and Stripe environment variables and uses the in-memory store.
- [ ] **Step 5:** Add a "Deploying the organizations data layer" note to `README.md`: back up the database, run `npm run migrate:orgs`, then deploy. Commit `git commit -m "Document the organizations migration"`.

---

## Phase 2 — Org routing (outline; detailed plan written when Phase 1 ships)

- `lib/db/family-repository.ts`: `childrenForParent`, `enrollmentsForParent` (grouped by org), `ordersForParent`, add and update child. Org-scoped per-entity methods are added to `forOrg` (`programs.list/get/insert/update`, `sessions.*`, `enrollments.*`).
- `lib/db/platform-repository.ts`: `getOrganizationBySlug`, `listLiveOrganizations`.
- `app/o/[slug]/layout.tsx` with `OrgProvider`; move `programs`, `clinics`, `showcases`, the home page content, `dashboard` → `admin`, and `player/registration` → `register` under it.
- `/api/orgs/[orgId]/…` endpoints replace the global ones. `/api/state` is removed; the registration provider loads org-scoped state, and parent pages use family endpoints. The roster uses `forOrg().roster()` (the visibility rule goes live here).
- `/account` replaces `/player`. `/` becomes the platform landing page (reusing the "Shifty Player Platform" section plus a list of live organizations).
- Redirects for the old URLs (`next.config` `redirects`) per the spec table.
- Tests: an isolation suite (Org A's admin calling with Org B's IDs gets 404) and e2e updated to the new URLs plus a redirect test.

## Phase 3 — Organizations and roles (outline)

- `memberships`, `org_invites` collections. On `users`, `role` is replaced by `isPlatformAdmin`, with a migration step in the spirit of spec migration step 4.
- `requireOrgRole`, `requirePlatformAdmin` (replacing `requireAdmin`); the login redirect rules from the spec.
- `/signup/org` (slug validation and the reserved list), admin Settings (profile, members, invite links, submit for review), `/platform` (approve, reject with a note, suspend, reinstate).
- Tests: slug rules, status transitions, permission matrix, e2e of the org signup → approval flow (Stripe stubbed).

## Phase 4 — Stripe Connect (outline)

- Express account creation and Account Links, the `account.updated` webhook, the "Finish Stripe setup" state.
- `create-payment-intent`: precondition checks (`live`, charges enabled, open, available, capacity), `transfer_data.destination`, `on_behalf_of`, `application_fee_amount`, `metadata.orgId`.
- Webhook: org lookup and cross-org clinic check, `markEnrollmentPaid(..., stripePaymentIntentId)`, an order with `platformFeeCents`, HubSpot gated on `hubspotEnabled`; metrics events gain `orgId`.
- Tests: PaymentIntent parameter construction, fee rounding, webhook rejection paths.

## Phase 5 — Later (separate specs)

HubSpot OAuth per organization, coach roles, custom domains.
