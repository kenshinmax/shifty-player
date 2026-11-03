# Implementation Plan: OpenTelemetry Integration to Splunk

**Product:** Shifty Player Platform
**Status:** Planned (pending approval — larger feature per AGENTS.md)
**Date:** 2026-10-31
**Companion doc:** [otel-splunk-prd.md](./otel-splunk-prd.md)

## 1. Current State

- `instrumentation.ts`: Next.js `register()` hook boots the async payment-verification worker (Node runtime only).
- `lib/metrics.ts`: `prom-client` registry with counters (`shifty_registrations_total`, `shifty_payments_total{status}`, `shifty_clinic_enrollments_total`) + default Node metrics, rendered at `GET /api/metrics`.
- `lib/metrics-client.ts`: browser fire-and-forget events to `POST /api/metrics/events`.
- `observability/`: example Docker Compose Prometheus scraping `localhost:3000/api/metrics` (local dev only).
- Env conventions: `.env.local`, loaded via `--env-file` in scripts.

## 2. Approach

**Decision (2026-11-02): export to Splunk Enterprise via HEC.** Splunk Enterprise's HEC does not ingest OTLP directly, so the pipeline has one extra hop compared to the original assumption:

```
Next.js app ──OTLP──▶ Splunk OTel Collector gateway ──HEC──▶ Splunk Enterprise
```

Use the **Splunk distribution of OpenTelemetry JavaScript** (`@splunk/otel`) in the app to produce traces and metrics, exported via **OTLP to a Splunk OpenTelemetry Collector gateway**, which forwards to Splunk Enterprise through the HEC exporter.

Rationale and consequences:

- One app dependency covers the SDK, auto-instrumentations (HTTP, `mongodb`, `undici`/`https`), and Splunk defaults.
- The collector gateway is a small, separately deployed component configured with the Splunk HEC token and target index (`splunk_hec_exporter`). It is infrastructure outside this repo; deployment is a prerequisite for Phase 4 (see Phases).
- Security win (PRD NFR2): the HEC token lives only in the collector configuration — the app holds no Splunk secret at all, it just points `OTEL_EXPORTER_OTLP_ENDPOINT` at the collector.
- Export is non-blocking and loss-tolerant by design (satisfies NFR1).
- Alternative revisited: if the organization later moves to Splunk Observability Cloud, only the collector's destination (or a direct OTLP endpoint + `SPLUNK_ACCESS_TOKEN` in the app) changes; app code is unaffected.

## 3. Design

### 3.1 Telemetry bootstrap

Create `lib/otel.ts` — a single small module that:

1. No-ops immediately if `OTEL_EXPORTER_OTLP_ENDPOINT` (or a dedicated `OTEL_ENABLED` flag) is unset, so local dev and tests are unaffected.
2. Calls `start()` from `@splunk/otel` with configuration from environment variables.
3. Registers a resource with `service.name = shifty-player`, `deployment.environment`, and `service.version`.
4. Applies a span processor that strips/never-sets disallowed attributes (enforces NFR2; deny-by-default for any auto-captured HTTP query strings or headers).

Call it from the existing `instrumentation.ts` `register()` (inside the `NEXT_RUNTIME === "nodejs"` guard) before the payment worker starts, so the worker and every API route share the tracer provider.

### 3.2 What gets instrumented automatically

- HTTP server spans for all `app/api/**/route.ts` handlers (route, method, status).
- MongoDB driver spans for all `lib/db` and `lib/mongo.ts` operations.
- Outgoing HTTP spans covering Stripe API calls (`lib/stripe.ts`, `lib/payment.ts`).
- Runtime metrics (CPU, memory, event loop) exported alongside traces.

### 3.3 Business metrics bridge

In `lib/metrics.ts`, keep the Prometheus registry untouched. Where `recordMetricsEvent()` increments Prometheus counters, additionally increment equivalent OTel counters (`shifty.registrations`, `shifty.payments` with `status` attribute, `shifty.clinic_enrollments`) via a thin wrapper in `lib/otel.ts`. This keeps `/api/metrics` working (PRD FR3 / backward compatibility) with a single point of change. The existing client events (`/api/metrics/events`) flow through the same path unchanged.

### 3.4 Worker correlation

In `lib/payment-verification.ts`, wrap each verification iteration in a span (`shifty.payment_verification`) with a `stripe.payment_intent.id` attribute. Because webhook traces carry the same attribute, flows can be correlated in Splunk by payment intent ID without modifying payment logic.

## 4. Configuration (environment variables only)

| Variable | Example | Purpose |
|---|---|---|
| `OTEL_ENABLED` | `true` / unset | Kill switch (NFR3); `true` in production only (PRD decision 2) |
| `OTEL_SERVICE_NAME` | `shifty-player` | Service identification |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector.internal:4318` | Collector gateway OTLP endpoint (the app holds no Splunk secret) |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` or `http/protobuf` | Export protocol to the collector |
| `OTEL_PROPAGATORS` | `tracecontext,baggage` | Context propagation |
| `OTEL_TRACES_SAMPLER` | e.g., `parentbased_traceidratio` | Sampling rate for production |
| `OTEL_TRACES_SAMPLER_ARG` | `1` | Keep all traces at launch (PRD decision 4) |

The Splunk HEC token and destination index are configured on the collector gateway only (secret stays out of the app entirely). App variables follow the existing `.env.local` conventions locally and the hosting platform's secret/environment store in production. Never committed, never logged (AGENTS.md security rules). Document the variables in `.env.example` with placeholder values.

## 5. Phases and Steps

### Phase 1 — Foundation (local)

> **Status (2026-11-01): implemented.** Steps 1–4 done; step 5 verified locally against a local OTLP HTTP receiver (traces and metrics exported, app unaffected). Verification against the real backend is pending the collector gateway deployment (Phase 3 prerequisite). Also added `@splunk/otel` to `serverExternalPackages` in `next.config.ts` so its native/deep requires are not bundled by the server build. The 2026-11-02 decision to target Splunk Enterprise via a collector gateway does not change any Phase 1 code: the app's `OTEL_EXPORTER_OTLP_ENDPOINT` now points at the collector, and the app holds no Splunk token.

1. Add `@splunk/otel` dependency (the only new dependency; justified by the PRD).
2. Create `lib/otel.ts` (bootstrap + attribute sanitizer + OTel counters).
3. Wire into `instrumentation.ts` before the worker start.
4. Add env variables with placeholders to `.env.example`; set real values in local `.env.local`.
5. Verify locally against Splunk: traces appear for login, registration start, and (with a test payment) the payment path; Mongo and Stripe child spans present; worker spans present.

### Phase 2 — Metrics bridge and privacy pass

> **Status (2026-11-02): implemented (SP-12).**
>
> 6. `recordMetricsEvent()` in `lib/metrics.ts` now also increments the OTel counters (`shifty.registrations`, `shifty.payments{status}`, `shifty.clinic_enrollments`); the Prometheus `/api/metrics` output is unchanged. Note: the metrics API has no proxy mechanism (unlike tracing), so `lib/otel.ts` creates its counters lazily — meters resolved before the global provider registers would stay no-op forever.
> 7. **PII audit of auto-captured span attributes (PRD NFR2), verified against the installed instrumentation sources:**
>    - HTTP server/client (`instrumentation-http`): no headers captured (capture lists default to empty and are never configured); `http.url`/`http.target` query strings stripped by the sanitizer.
>    - Stripe calls (`instrumentation-undici`): sets `url.full` (query stripped by sanitizer), `url.query` (redacted), `url.path`, method, status, server address — no request/header bodies, no auth material.
>    - MongoDB (`instrumentation-mongodb`): sets db system/namespace/operation/collection names and `db.query.text` (serialized command, can embed document data) — `db.query.text` is redacted by the sanitizer.
>    - Worker span (`shifty.payment_verification`, added in `lib/payment-verification.ts`): carries only `stripe.payment_intent.id` (permitted for correlation).
>    - Residual risk check deferred to Phase 3 staging validation (live payload review).

6. Add the OTel counters bridge in `lib/metrics.ts` per 3.3; keep `/api/metrics` output byte-identical.
7. Audit captured span attributes for PII (NFR2): confirm no player/customer fields, no auth headers, no Stripe tokens; payment intent IDs only.

### Phase 3 — Validation and collector gateway

> Launch scope (PRD decision 2): telemetry is enabled in **production only**. Staging enables it temporarily for the validation below.

8. **Prerequisite (infrastructure):** deploy the Splunk OpenTelemetry Collector gateway with a `splunk_hec_exporter` pipeline configured with the provisioned HEC token and destination index (secret lives only in the collector config). App-side change: none — point `OTEL_EXPORTER_OTLP_ENDPOINT` at the collector.
9. Enable telemetry temporarily in staging via the platform's environment configuration; run the Playwright e2e suite (`npm run test:e2e`) against staging and confirm traces for every flow covered (including the collector → Splunk Enterprise hop).
10. Compare checkout latency and error rates to pre-rollout baseline (NFR1 acceptance).
11. Build Splunk Enterprise dashboards: payment success/failure rate, registration funnel, per-endpoint latency, Mongo/Stripe dependency latency; configure alerts (e.g., payment failure rate spike) — dashboard/alert config is a Splunk-side task, tracked separately.

### Phase 4 — Production rollout and cleanup

12. Enable in production (`OTEL_ENABLED=true` only there) keeping all traces initially (`OTEL_TRACES_SAMPLER_ARG=1`, PRD decision 4); adjust sampling later if volume demands.
13. Monitor for one release cycle against the PRD success metrics.
14. Decide follow-ups: retire local Prometheus example docs, browser RUM, structured logs (out of scope here).

## 6. Files Affected

| File | Change |
|---|---|
| `package.json` | Add `@splunk/otel` |
| `lib/otel.ts` | **New** — bootstrap, sanitizer, OTel counters |
| `instrumentation.ts` | Call OTel bootstrap in `register()` (Node runtime guard already present) |
| `lib/metrics.ts` | Add OTel counter increments alongside Prometheus counters |
| `lib/payment-verification.ts` | Add worker span wrapper (no logic changes) |
| `.env.example` | Document OTEL_* variables with placeholders |

No changes to payment processing logic, routes, schemas, or the Stripe workflow.

## 7. Testing

- Unit (vitest): `lib/otel.ts` no-ops when disabled; sanitizer strips disallowed attributes; `recordMetricsEvent` increments both Prometheus counters and OTel counters; `/api/metrics` response unchanged (snapshot).
- Existing suite: `npm run test` and `npm run lint` must pass; `npm run test:e2e` against staging in Phase 3.
- Manual local verification: traces/metrics visible in Splunk for login, registration, and test payment; telemetry visibly degraded (app unaffected) when the ingest endpoint is unreachable.
- Payment regression focus: confirm-enrollment and webhook behavior untouched (AGENTS.md: preserve payment workflows).

## 8. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Instrumentation adds latency to checkout | NFR1 baseline comparison in Phase 3; sampling in production; kill switch `OTEL_ENABLED` |
| PII/secrets leak into telemetry | Deny-by-default sanitizer; audit step in Phase 2; HEC token lives only in the collector gateway config, never in the app |
| Exporter failure affects requests | Export is async/non-blocking; verified by manual degradation test |
| Next.js/`register()` hook incompatibilities with `@splunk/otel` version | Validate early in Phase 1 (step 5) before building further |
| Duplicate payment metrics (Prometheus + Splunk) drift | Single bridge point in `recordMetricsEvent`; acceptance check 3 in PRD |

## 9. Approval

Per AGENTS.md (larger feature), implementation waits for approval of this plan and the companion PRD. The PRD's open questions were resolved on 2026-11-02 (destination: Splunk Enterprise via HEC; production-only launch; HEC credentials provisioned; 100% trace sampling at launch), so Phases 2–4 are unblocked. The remaining external prerequisite is the collector gateway deployment (Phase 3, step 8).
