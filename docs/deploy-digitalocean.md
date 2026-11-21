# Deploying to DigitalOcean App Platform (demo / staging)

Spec: [`.do/app.yaml`](../.do/app.yaml). One Node service built from GitHub,
backed by MongoDB Atlas, Stripe in **test mode**, telemetry off (logs go to
stdout and appear under the app's **Runtime Logs**). Roughly $5/month for the
app plus Atlas (free M0 tier is enough).

## Constraints to keep

- **One instance only.** The payment-verification worker runs inside the app
  process and Prometheus counters live in process memory. Do not raise
  `instance_count` or enable autoscaling.
- **Production requires MongoDB.** With `NODE_ENV=production` the app refuses
  to start without `MONGODB_URI` (see `assertPersistentStore` in `lib/mongo.ts`),
  so a missing secret shows up as a failed deploy, not lost data.
- `/api/admin/seed` is disabled in production. Demo data (programs, players,
  `user@demo.com` / `admin@demo.com`) is seeded on the first request to an
  empty database. These are known logins on a public URL: demo data only.

## 1. MongoDB Atlas

Reuse an existing cluster (a new free **M0** also works).

1. The app uses its own database, `shifty_staging` (`MONGODB_DB` in
   `.do/app.yaml`), so staging data never mixes with local/dev data. It starts
   empty and seeds on the first request.
2. Create a database user limited to `shifty_staging` (readWrite) for this app.
3. Network Access: App Platform has no fixed outbound IP and M0 cannot use DO
   private networking, so allow `0.0.0.0/0` for this demo. This applies to the
   whole cluster. Keep the user's password strong.
4. Copy the connection string (`mongodb+srv://...`) for step 3.

## 2. Push the code

App Platform builds from GitHub (`kenshinmax/shifty-player`, branch `main`
the spec). Only committed and pushed code is deployed. Change `branch` in
`.do/app.yaml` to deploy a different branch.

## 3. Create the app

```bash
doctl apps create --spec .do/app.yaml
```

(or **Create App** in the DO console and import the spec). Then set the
secrets under the app's environment variables:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Atlas connection string |
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` (replace the placeholder; a rebuild is needed, it is inlined at build time) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from step 4 |
| `HUBSPOT_ACCESS_TOKEN` | optional; without it HubSpot sync is skipped |

## 4. Stripe webhook

1. After the first deploy, note the app URL (`https://<app>.ondigitalocean.app`).
2. Stripe Dashboard (test mode) → Developers → Webhooks → add endpoint
   `https://<app>.ondigitalocean.app/api/stripe/webhook`. Select only
   `payment_intent.succeeded`; the route ignores every other event type.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

## 5. Smoke test

1. Home page lists the sample organization; `/o/shifty-player/programs` loads.
2. Sign up as a parent, register a player, pay with `4242 4242 4242 4242`.
3. `GET /api/payments/<paymentIntentId>/status` reaches `enrolled`.
4. Runtime Logs show requests and no startup error.

## Troubleshooting

- **Deploy fails at startup with "MONGODB_URI is required"**: the secret is
  missing or empty.
- **Mongo timeouts**: Atlas Network Access does not allow the app's IPs.
- **Card form shows the demo form instead of Stripe**: `STRIPE_SECRET_KEY` or
  the publishable key is unset (the publishable key needs a rebuild).
- **Enabling Splunk later**: set `OTEL_ENABLED=true` and
  `OTEL_EXPORTER_OTLP_ENDPOINT`; see
  [`observability/otel-splunk-runbook.md`](../observability/otel-splunk-runbook.md).
