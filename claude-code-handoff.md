# Handoff: HubSpot CRM sync for shifty-player

Paste this into Claude Code from inside your local `shifty-player` clone, with `hubspot-integration.patch` in the repo root.

---

Context: I'm building a youth basketball registration app (Next.js 16, MongoDB, Stripe). In a previous session, we added a HubSpot CRM sync. It's in `hubspot-integration.patch`.

Please:
1. Create a branch `hubspot-crm-sync`, then run `git apply hubspot-integration.patch`.
2. Run `npm install`, `npm test`, `npx next typegen && npx tsc --noEmit`, `npm run build` and `npm run test:e2e`. Fix anything that fails. The build and e2e tests were not verified before, because Google Fonts couldn't be reached in that environment.
3. Commit, push, and open a PR.

What the patch does:
- `lib/hubspot.ts`: upserts a contact by email via `POST /crm/v3/objects/contacts/batch/upsert`. It does nothing without `HUBSPOT_ACCESS_TOKEN`, and it never throws.
- `lib/hubspot-sync.ts`: after a paid enrollment, looks up the player's parent and updates their contact.
- On signup (`app/api/auth/signup/route.ts`): sets `lifecyclestage=lead`, `shifty_marketing_opt_in` and `shifty_signup_date`. The call runs through `after()`.
- On paid enrollment (Stripe webhook and `confirm-enrollment`): sets `lifecyclestage=customer`, player count, grades, last program, and last payment date and amount. It runs only once per payment, when `claimProcessedPayment` succeeds.
- The signup form gets a marketing opt-in checkbox (`components/login-page-content.tsx`). The value is stored as `marketingOptIn` on the user.
- `scripts/hubspot-setup.mjs`: creates the 7 custom `shifty_*` contact properties. Run it once.
- `__tests__/hubspot.test.ts`: 7 tests, including one that checks children's personal data is never sent.
- `.env.example` and the README are updated.

Known limitation: the payment amount is the latest order only, because the app keeps only the most recent `merchandiseOrder` per player.

Possible next steps: sync subscription/cancel events if recurring billing is added, and map opt-in to HubSpot subscription types.
