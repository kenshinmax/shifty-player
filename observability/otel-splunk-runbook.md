# Phase 3: collector gateway and staging validation

## Status and ownership

Repository artifacts are ready for operator review. **Phase 3 acceptance is not
complete.** No collector, Splunk object, or staging configuration has been
deployed or changed. The staging URL/access method and live evidence are pending.
Do not enable production telemetry until the gates below pass.

Use Node 22+ (Node 24 was used for local checks). The default shell's Node 18
cannot run the installed Vitest/Vite toolchain.

## 1. Provision the collector destination

The infrastructure/Splunk owner must provide:

- A private collector host/network reachable by the app, with at least 512 MiB
  allocated to this template. Do not expose unauthenticated OTLP to the internet.
- An HTTPS HEC endpoint, such as `https://splunk.example.com:8088/services/collector`.
- An **event index** for traces and a separate **metrics index** for metrics.
  One index cannot serve both data types. Example names below are `shifty_traces`
  and `shifty_metrics`; substitute the provisioned names.
- A HEC token authorized for both indexes. Keep it in the collector's secret
  store only, never the app, Git, terminal output, or an evidence attachment.
- Read-only Splunk search access for validation. HEC tokens cannot search data.

`compose.otel.yaml` pins Splunk Collector **0.164.0** by release manifest digest.
`otel-collector.yaml` receives OTLP HTTP/gRPC and exports both signals using
`splunk_hec`, with TLS certificate verification, bounded in-memory queues,
60-second retries, batching, and a memory limiter. Queues are loss-tolerant,
not durable. There is no log pipeline, payload debug exporter, or profiling.

Inject these variables using the infrastructure secret manager or an external
protected env file (not the app's `.env.local`):

| Collector variable | Value |
| --- | --- |
| `SPLUNK_HEC_URL` | HTTPS HEC endpoint |
| `SPLUNK_HEC_TOKEN` | Secret, collector only |
| `SPLUNK_TRACES_INDEX` | Existing event index |
| `SPLUNK_METRICS_INDEX` | Existing metrics index |

From the repository root, an operator can validate and then deploy:

```sh
docker compose --env-file /secure/collector.env -f observability/compose.otel.yaml config --quiet
docker compose --env-file /secure/collector.env -f observability/compose.otel.yaml run --rm --no-deps otel-collector validate --config=/etc/otelcol/collector.yaml
# Only after approval of the deployment target and configuration:
docker compose --env-file /secure/collector.env -f observability/compose.otel.yaml up -d
```

Do not run `config` without `--quiet`, or print the container environment:
expanded configuration contains the token. For private CAs, mount a CA file and
set each exporter's `tls.ca_file`; never disable verification.

The Compose ports bind to **127.0.0.1 only**. This is appropriate for same-host
apps or a private tunnel, not a remotely hosted app. For remote deployment,
the infrastructure owner must supply private routing and authenticated TLS
ingress (or mTLS), then expose only the needed OTLP protocol to app instances.
Do not merely change the binding to a public interface. Health (`13133`) and
collector metrics (`8888`) must stay private. Health alone proves neither HEC
delivery nor search visibility.

## 2. Temporarily enable staging telemetry

Set on the staging **app**, not the collector:

```dotenv
OTEL_ENABLED=true
OTEL_SERVICE_NAME=shifty-player
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.internal:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_PROPAGATORS=tracecontext,baggage
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=1
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=staging,deployment.environment.name=staging,service.version=RELEASE_ID,service.instance.id=INSTANCE_ID
```

Replace the endpoint with the actual reachable private/TLS ingress. HTTP without
TLS is only for an isolated trusted network. Use a unique instance ID for every
app process so counter streams do not collide. Supply the actual release ID and
verify attribution on **both** signals. No HEC token belongs in these settings.
Do not put PII or credentials in resource attributes or baggage.

Restart/redeploy staging after changing its environment. Keep the exact same
release and workload for the telemetry-off baseline, telemetry-on candidate,
and collector-unreachable comparison. Record deployment times and export
intervals; allow queued batches to arrive before searching.

## 3. Browser regression checks, disposable environments only

The local command remains `npm run test:e2e`; it still starts its isolated local
server. The separate remote command **never starts a local server**:

```sh
E2E_BASE_URL=https://disposable-staging.example.com \
E2E_DISPOSABLE_ORIGIN=https://disposable-staging.example.com \
E2E_ALLOW_DATA_RESET=true \
npm run test:e2e:staging
```

Both origin values must match exactly. Credentials, query strings, fragments,
and non-root paths are refused. HTTPS is required except for loopback tests.
Only use this with explicit permission to reset/create data in that target.
Remote tests run serially with no retries or trace/video/screenshot recording.
Protect remaining test output: failed assertions may still contain fixture data.
Use synthetic accounts only and do not upload remote test artifacts.

**Important limitations:** the existing suite calls the destructive
`/api/admin/seed` helper and expects demo checkout/demo accounts. It therefore
requires a disposable **dev/test-mode** deployment, isolated from real data,
with Stripe and HubSpot disabled. The seed route correctly returns 404 in a
production build; do not bypass that guard to make these tests pass.
For production-like staging, use separately approved synthetic flows rather
than this destructive suite. Passing demo tests does **not** validate Stripe,
MongoDB instrumentation, webhook delivery, or worker correlation.

## 4. Verify the app → collector → HEC → Splunk path

On a production-like staging instance with a disposable MongoDB and **Stripe
test-mode** configuration, perform approved synthetic flows:

1. Login, browse programs, start registration, complete a test payment, and
   wait for enrollment. Exercise payment failure/retry, confirm-enrollment,
   the webhook, and the background verifier without altering payment logic.
2. In collector metrics, check accepted/sent spans and metric points increase.
   Inspect refused/failed exports and queue utilization. Do not enable detailed
   payload logging to debug missing data.
3. Search the trace event index and verify the service/environment/version,
   route/method/status, MongoDB child spans, Stripe HTTP child spans, and
   `shifty.payment_verification`. Verify worker correlation using a synthetic
   `stripe.payment_intent.id`. Confirm actual correlation on the other spans;
   do not assume webhook spans have that attribute merely because the plan says so.
4. Verify all three OTel counters and both payment statuses in the metrics
   index. Compare **counter deltas** with the matching Prometheus process
   over the same interval. Avoid restarts during this check. Browser and
   server events can both contribute; compare the two backends, not an assumed
   one-event-per-checkout count.
5. Review representative success **and error** payloads in Splunk, including
   resource attributes, span names, URLs, events, links, and status messages.
   Confirm no synthetic PII canaries, query strings, auth headers, tokens,
   database documents, or payment details remain. Payment intent IDs are
   permitted. Record findings, not raw payloads containing sensitive data.
6. Make the staging collector unreachable through an approved reversible
   network/configuration change. Repeat checkout, confirm enrollment still
   completes, and measure latency/error rate. Restore connectivity afterward.
   An HTTP 200 alone is not evidence of successful enrollment.

Do not mark the end-to-end gate passed from a collector health response or a
mock OTLP receiver. Require actual search-visible traces and metrics in Splunk.

### Search starting points

These queries match the pinned HEC translator's span JSON and metric names.
They are templates, not deployed dashboards; verify extraction on live events
and filter the precise staging time window, environment, and release.

```spl
index=shifty_traces sourcetype="otel:traces" "service.name"="shifty-player"
| spath
| eval duration_ms=(end_time-start_time)/1000000
| table _time trace_id span_id parent_span_id name kind duration_ms attributes.* status.*
```

```spl
| mstats latest(shifty.payments) AS total WHERE index=shifty_metrics "service.name"="shifty-player" BY status,service.instance.id
```

Metrics retain OTel names with dots, not the Prometheus underscore names.
The HEC exporter sends cumulative sum values without changing their
temporality. Do **not** sum every exported counter sample, which overcounts.
For rate/funnel panels, derive reset-aware deltas per instance before
aggregating. If the SDK uses delta temporality instead, sum deltas and document
that verified setting. Do not guess the temporality from the metric name.

## 5. Checkout latency and error-rate gate

Measure genuine requests to **both** `POST /api/stripe/create-payment-intent`
and `POST /api/stripe/confirm-enrollment`, including failures, first calls after
a fresh app process, and the largest supported checkout cart. Use successful
synthetic test payments, not demo checkout or unauthenticated rejection loops.
Include Mongo/Stripe child spans when inspecting the cause of any regression.

Use the same independent timer at the ingress/load generator for both runs.
Telemetry-off baseline requests cannot be recovered from OTel spans.
Do not compare browser wall-clock time with server-only spans. Record region,
concurrency, cart, runtime, version, and cold/warm mix with the evidence.

Export timing samples as JSON with **no identifiers, URLs, tokens, or bodies**:

```json
{
  "schemaVersion": 1,
  "environment": "staging",
  "serviceVersion": "RELEASE_ID",
  "telemetryEnabled": false,
  "samples": [
    {"route": "POST /api/stripe/create-payment-intent", "durationMs": 42.5, "failed": false},
    {"route": "POST /api/stripe/confirm-enrollment", "durationMs": 18.2, "failed": false}
  ]
}
```

Set `telemetryEnabled: true` in the candidate. The two-sample example is a
schema illustration and deliberately **cannot pass** the evidence gate.
Collect at least 100 samples **per endpoint per run** (a tooling minimum,
not proof of statistical confidence); repeat representative runs when near
the threshold. Include error outcomes, not just successful-request timings.

```sh
npm run otel:compare -- outputs/otel-baseline.json outputs/otel-enabled.json
```

The offline tool validates metadata and finite nonnegative samples, computes
nearest-rank p95 separately per endpoint, and requires a p95 increase **strictly
below 5 ms** and no increase in error rate at **either** endpoint. Exit codes:
`0` passes those numeric checks, `1` fails, `2` is invalid/insufficient evidence.
Repeat with the collector-unreachable candidate. A passing comparison does
not replace independent enrollment completion, privacy, or Splunk delivery checks.

## 6. Splunk-owned dashboards and alerts

After live field/temporality validation, the Splunk owner should create:

| Panel | Evidence/data |
| --- | --- |
| Payment success/failure rate | Reset-aware `shifty.payments` deltas by `status` |
| Registration funnel | `shifty.registrations` and `shifty.clinic_enrollments` deltas |
| Per-endpoint p50/p95, volume, errors | Server spans, route/method/status and nanosecond start/end times |
| Mongo/Stripe dependency latency | Database/client child spans, excluding parent duplicates |

Scope every panel and alert by environment/release. For payment-failure alerts,
agree on the evaluation window, minimum payment volume, threshold, notification
destination, and suppression/recovery policy with the owner; test using synthetic
failures. Also alert on exporter failures/queue saturation and missing telemetry.
Do not create or enable external alerts without approval of those settings.

## 7. Acceptance record and cleanup

Record the release, collector version, reviewer, time windows, and results:

- [ ] Collector config passes the pinned binary's `validate` command.
- [ ] Private routing/TLS, HEC permissions, and both index types verified.
- [ ] Approved browser regressions completed, with demo coverage identified.
- [ ] Real Mongo/Stripe/worker flow and Splunk search visibility verified.
- [ ] Metrics match Prometheus deltas, with no dropped export evidence.
- [ ] Live success/error payload audit has zero PII findings.
- [ ] Enabled and unreachable-collector p95/error comparisons pass.
- [ ] Enrollment correctness is unchanged during telemetry outage.
- [ ] Dashboard/alert owners sign off on their separately deployed objects.
- [ ] Staging `OTEL_ENABLED` restored to `false` after validation.

If a gate fails, keep production telemetry off, preserve only redacted evidence,
and fix/retest it. Disabling app telemetry and restarting staging is the kill
switch. Collector rollback is an infrastructure-owned redeploy of the previous
approved image/config; do not change payment or database state to roll it back.

### Upstream references

- [Pinned collector release and manifest digest](https://github.com/signalfx/splunk-otel-collector/releases/tag/v0.164.0)
- [HEC exporter configuration](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.164.0/exporter/splunkhecexporter)
- [Trace and metric translation](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.164.0/pkg/translator/splunk)
