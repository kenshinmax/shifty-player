# Product Requirements Document: OpenTelemetry Integration to Splunk

**Product:** Shifty Player Platform
**Status:** Planned
**Date:** 2026-10-31
**Owner:** TBD

## 1. Background

The platform currently has a minimal, local-only observability setup:

- A `prom-client` registry (`lib/metrics.ts`) exposes a few counters (registration starts, payment outcomes, clinic enrollments) plus default Node metrics at `GET /api/metrics`.
- A local Docker Compose Prometheus (see `observability/docker-compose-prometheus.yml`) can scrape that endpoint during development.
- The browser client fires anonymous metric events (`registration_started`, `payment_succeeded`, `payment_failed`) to `POST /api/metrics/events` via `lib/metrics-client.ts`.

There is no distributed tracing, no visibility into MongoDB or Stripe call latency, no way to correlate a checkout across the API route, Stripe webhook, and the background payment-verification worker, and no centralized dashboards or alerting. The local Prometheus setup does not serve production.

## 2. Problem Statement

When a parent reports a failed or stuck registration, we currently cannot answer:

- Where did the flow break: the API route, MongoDB, the Stripe API, or the background verification worker?
- How long do Stripe and MongoDB calls take, and are they degrading?
- Are errors spiking after a deploy, and for which endpoint?

Support and engineering rely on reproduction and guesswork, which slows resolution of payment-affecting issues.

## 3. Goals

1. Export traces and metrics from the Next.js server to Splunk (Splunk Observability Cloud) using OpenTelemetry.
2. Trace the full registration/payment path end to end, including MongoDB operations, Stripe API calls, the Stripe webhook, and the background payment-verification worker started in `instrumentation.ts`.
3. Preserve the existing Prometheus `/api/metrics` endpoint for backward compatibility during the transition.
4. Provide visibility into HTTP API performance (latency, status codes, error rates) per route.
5. Keep the registration and payment UX completely unaffected by telemetry collection or telemetry failures.

## 4. Non-Goals

- Rewriting or replacing the existing `prom-client` metrics or the payment workflows they measure.
- Full browser RUM / session replay (candidate for a follow-up phase).
- Log shipping to Splunk (the app currently has no structured logging pipeline; tracing plus metrics come first).
- Real User Monitoring (RUM) beyond the existing client metric events.
- Instrumenting the MongoDB database itself or any third-party services.

## 5. Functional Requirements

### FR1 — Distributed tracing

- All Next.js server route handlers (`app/api/**/route.ts`) produce traces with standard HTTP server spans (route, method, status code).
- Outgoing calls produce child spans, at minimum:
  - MongoDB commands (driver instrumentation).
  - Stripe API calls (HTTP client instrumentation).
- The background payment-verification worker (`lib/payment-verification.ts`) produces traces that link to the checkout flow it continues (e.g., shared trace context or a span attribute carrying the payment intent ID).
- Error spans capture the exception message and type; the exception is also recorded on the span.

### FR2 — Metrics export

- Key counters (registrations started, payment outcomes by status, clinic enrollments) are exported to Splunk as OTel metrics, in addition to the existing Prometheus endpoint.
- Standard server metrics (request rate, error rate, duration histogram) are exported automatically by the instrumentation layer.

### FR3 — Resource attribution

- All telemetry is tagged with a service name (`shifty-player`), deployment environment (e.g., `dev` / `staging` / `production`), and application version so data can be filtered per environment and release.

### FR4 — Trace/metric visibility in Splunk

- Traces and metrics are ingested into Splunk Enterprise via HEC (through an OpenTelemetry Collector gateway; see the implementation plan).
- Metrics are available for dashboards covering registration funnels and payment success/failure rates.
- Traces are searchable in Splunk. Note: Splunk Enterprise does not include the Splunk APM service-graph UI, so per-endpoint and dependency latency views are built as Splunk dashboards from the exported metrics and trace data.

## 6. Non-Functional Requirements

### NFR1 — Zero impact on user-facing behavior (mandatory)

- Telemetry export failures (network, auth, Splunk outage) must never throw into request handling, must not fail requests, and must never block or slow the checkout UX. Buffering/export must be non-blocking and loss-tolerant.
- Checkout API latency impact from instrumentation should be negligible (target < 5 ms per request on p95) and overhead should be measured before rollout.

### NFR2 — Privacy and security (mandatory)

- No player or customer PII in telemetry attributes: no names, emails, addresses, phone numbers, session tokens, or full payment details. Payment intent IDs are permitted for correlation; Stripe API keys and tokens are never included.
- Splunk credentials (ingest access token) are provided only via environment variables, following the existing `.env.local` conventions. No secrets in code, logs, or the repository.
- Telemetry payloads are documented and reviewed for PII before enabling in production.

### NFR3 — Reliability and graceful degradation

- If telemetry is misconfigured or Splunk is unreachable, the app behaves exactly as it does today (telemetry silently degrades).
- The feature must be toggleable per environment via configuration, with the ability to disable telemetry entirely.

### NFR4 — Maintainability

- Follow existing patterns: keep telemetry setup small and centralized (one module), avoid new dependencies beyond the Splunk/OpenTelemetry distribution package, and prefer configuration over custom code.
- Do not modify payment processing logic; instrumentation is additive and read-only with respect to business logic.

## 7. Success Metrics

1. 100% of `app/api` routes emit HTTP server traces to Splunk within one release.
2. Registration-to-enrollment flows can be followed across Stripe webhook and background worker traces.
3. Splunk dashboards show payment success/failure rates matching the existing `/api/metrics` counters.
4. No increase in checkout error rates or latency attributable to telemetry (verified against pre-rollout baselines).
5. Zero PII findings in a telemetry payload audit before production enablement.

## 8. Decisions (2026-11-02)

Resolved from the Open Questions below:

1. **Destination: Splunk Enterprise with HEC.** Telemetry flows app → OTLP → Splunk OpenTelemetry Collector gateway → HEC → Splunk Enterprise. The app never holds the HEC token (it lives only in the collector configuration).
2. **Environments: production only** at launch (local dev and non-production stay off by default via the env gate; staging may enable telemetry temporarily for validation).
3. **Credentials: provisioned.** A HEC token for the Splunk Enterprise instance is available; the collector gateway deployment is tracked in the implementation plan.
4. **Browser RUM: remains a non-goal** for this effort; the existing client metric events stay as they are.

### Open Questions (superseded — retained for history)

1. Which Splunk destination: Splunk Observability Cloud (SaaS, OTLP ingest) or Splunk Enterprise with HEC? → **Splunk Enterprise with HEC.**
2. Which environments (dev / staging / production) get telemetry at launch, and what data retention applies? → **Production only**; retention per existing Splunk Enterprise index settings.
3. Is a Splunk account and ingest access token available, and who owns access management? → **Yes, provisioned.**
4. Should client-side events (`/api/metrics/events`) eventually migrate to full browser RUM? → **Deferred (Non-Goals).**
