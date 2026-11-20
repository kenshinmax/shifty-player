/**
 * OpenTelemetry bootstrap for Splunk export.
 * See docs/superpowers/plans/otel-splunk-implementation-plan.md.
 *
 * Telemetry is entirely environment-configured and no-ops unless
 * OTEL_ENABLED=true and OTEL_EXPORTER_OTLP_ENDPOINT are set, so local dev,
 * tests, and app behavior are unaffected when telemetry is off (PRD NFR3).
 * Bootstrap failures are swallowed: telemetry must never affect requests
 * or the checkout UX (PRD NFR1).
 */
import type { Attributes, Span } from "@opentelemetry/api";
import type { ReadableSpan, SpanProcessor } from "@opentelemetry/sdk-trace";
import { metrics as otelMetrics, type Counter } from "@opentelemetry/api";
import type { MetricsEventType } from "@/lib/metrics-client";

const globalForOtel = globalThis as typeof globalThis & {
  __shiftyOtelStarted?: boolean;
};

const REDACTED = "[REDACTED]";

/** Only reviewed operational attributes retain their values (PRD NFR2). */
const SAFE_ATTRIBUTE_KEYS = new Set([
  "http.route", "http.method", "http.request.method", "http.status_code",
  "http.response.status_code", "http.scheme", "http.flavor",
  "url.scheme", "server.address", "server.port",
  "net.peer.name", "net.peer.port", "net.host.name", "net.host.port",
  "network.protocol.name", "network.protocol.version", "network.transport",
  "db.system", "db.system.name", "db.name", "db.namespace",
  "db.operation", "db.operation.name", "db.mongodb.collection", "db.collection.name",
  "next.span_type", "next.route", "next.rsc", "next.bubble",
  "exception.type", "exception.escaped", "error.type",
  "stripe.payment_intent.id",
]);

/** Keys whose value may contain a query string with user data; keep the path. */
const URL_KEYS = /^(http\.(url|target)|url\.(full|path)|next\.span_name)$/i;

function scrubUrl(value: unknown): string {
  if (typeof value !== "string") return REDACTED;
  const withoutQuery = value.split(/[?#]/)[0];
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(withoutQuery)) return withoutQuery;
  try {
    const url = new URL(withoutQuery);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return REDACTED;
  }
}

type WritableSpan = Span & { attributes?: Attributes };

/**
 * Overwrites sensitive span attributes so they never leave the app.
 * Runs at span start and again at span end (attributes may be set after
 * start) and runs before the Splunk export processors. HTTP header capture
 * is disabled by the Splunk distribution and is never enabled here.
 */
export class SanitizingSpanProcessor implements SpanProcessor {
  onStart(span: Span): void {
    scrubAttributes((span as WritableSpan).attributes);
  }

  onEnd(span: ReadableSpan): void {
    // The SDK refuses setAttribute() after end(). Its exported attribute maps
    // remain mutable: scrub them before downstream processors queue the span.
    scrubAttributes(span.attributes);
    (span as { name: string }).name = scrubUrl(span.name);
    for (const event of span.events) scrubAttributes(event.attributes);
    for (const link of span.links) scrubAttributes(link.attributes);
    if (span.status.message) span.status.message = REDACTED;
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

function scrubAttributes(attributes?: Attributes): void {
  if (!attributes) return;
  for (const key of Object.keys(attributes)) {
    if (URL_KEYS.test(key)) attributes[key] = scrubUrl(attributes[key]);
    else if (!SAFE_ATTRIBUTE_KEYS.has(key)) attributes[key] = REDACTED;
  }
}

/**
 * Business counters for the metrics bridge in lib/metrics.ts.
 *
 * Created lazily: the metrics API (unlike the tracing API) has no proxy
 * mechanism, so meters resolved before startOtel() registers the global
 * provider stay bound to the no-op meter forever. First use happens after
 * registration (register() awaits startOtel() before traffic is served).
 * While telemetry is disabled the global provider is a no-op, so these
 * no-op harmlessly. Re-resolve counters if the provider changes, so an early
 * no-op lookup cannot permanently disable business metrics.
 */
type BusinessCounters = {
  registrationsTotal: Counter;
  paymentsTotal: Counter;
  clinicEnrollmentsTotal: Counter;
};

let businessCounters: BusinessCounters | undefined;
let businessMeterProvider: ReturnType<typeof otelMetrics.getMeterProvider>;

function getBusinessCounters(): BusinessCounters {
  const provider = otelMetrics.getMeterProvider();
  if (!businessCounters || provider !== businessMeterProvider) {
    const meter = otelMetrics.getMeter("shifty-player");
    businessCounters = {
      registrationsTotal: meter.createCounter("shifty.registrations", {
        description: "Registration checkout starts (continue to payment).",
      }),
      paymentsTotal: meter.createCounter("shifty.payments", {
        description: "Payment outcomes from parent checkout.",
      }),
      clinicEnrollmentsTotal: meter.createCounter("shifty.clinic_enrollments", {
        description: "Successful clinic enrollments after payment.",
      }),
    };
    businessMeterProvider = provider;
  }
  return businessCounters;
}

export const otelCounters = {
  get registrationsTotal() {
    return getBusinessCounters().registrationsTotal;
  },
  get paymentsTotal() {
    return getBusinessCounters().paymentsTotal;
  },
  get clinicEnrollmentsTotal() {
    return getBusinessCounters().clinicEnrollmentsTotal;
  },
};

/** Telemetry failures must not interrupt the existing Prometheus/payment path. */
export function recordOtelMetricsEvent(type: MetricsEventType): void {
  try {
    switch (type) {
      case "registration_started":
        otelCounters.registrationsTotal.add(1);
        break;
      case "payment_succeeded":
        otelCounters.paymentsTotal.add(1, { status: "succeeded" });
        otelCounters.clinicEnrollmentsTotal.add(1);
        break;
      case "payment_failed":
        otelCounters.paymentsTotal.add(1, { status: "failed" });
        break;
    }
  } catch {
    // Loss-tolerant by design. Never log payloads or credentials.
  }
}

/** Telemetry runs only when explicitly enabled with a Splunk ingest endpoint. */
export function isOtelEnabled(): boolean {
  return (
    process.env.OTEL_ENABLED === "true" &&
    Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT)
  );
}

/**
 * Starts the Splunk OpenTelemetry distribution. Idempotent: Next.js can call
 * register() more than once per process (dev HMR, route compile), and the
 * distribution throws if started twice.
 */
export async function startOtel(): Promise<void> {
  if (!isOtelEnabled() || globalForOtel.__shiftyOtelStarted) return;
  globalForOtel.__shiftyOtelStarted = true;

  try {
    // Dynamic imports: the distribution (and its native bindings) is never
    // loaded when telemetry is disabled.
    const [{ start }, { defaultSpanProcessorFactory }] = await Promise.all([
      import("@splunk/otel"),
      import("@splunk/otel/lib/tracing/options"),
    ]);

    start({
      tracing: {
        // Compose with the default (export) processors: a custom factory
        // replaces them, so the sanitizer must come first in the chain.
        spanProcessorFactory: (options) => {
          const defaults = defaultSpanProcessorFactory(options);
          const defaultList = Array.isArray(defaults)
            ? defaults
            : [defaults];
          return [new SanitizingSpanProcessor(), ...defaultList];
        },
      },
      metrics: true,
      profiling: false,
      logging: false,
      opamp: false,
      secureapp: false,
    });
  } catch {
    // Never let telemetry break the app; degraded telemetry is acceptable.
    // SDK errors can contain endpoint credentials or other configuration.
    console.error("OpenTelemetry bootstrap failed.");
  }
}
