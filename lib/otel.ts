/**
 * OpenTelemetry bootstrap for Splunk export.
 * See documentation/planned/otel-splunk-implementation-plan.md (Phase 1).
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

const globalForOtel = globalThis as typeof globalThis & {
  __shiftyOtelStarted?: boolean;
};

const REDACTED = "[REDACTED]";

/** Keys that must never be exported with their original value (PRD NFR2). */
const FULLY_REDACTED_KEYS =
  /header|cookie|authorization|token|password|secret|email|url\.query|db\.statement|db\.query/i;

/** Keys whose value may contain a query string with user data; keep the path. */
const URL_KEYS = /(^|\.)http\.(url|target)$|(^|\.)url\.full$/i;

function scrubValue(key: string, value: unknown): string {
  const asString = typeof value === "string" ? value : String(value);
  if (URL_KEYS.test(key)) return asString.split("?")[0];
  return REDACTED;
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
    scrubAttributes(span as WritableSpan);
  }

  onEnd(span: ReadableSpan): void {
    // onEnd receives the same mutable span object; scrub late-set attributes
    // before the downstream export processors queue the span.
    scrubAttributes(span as unknown as WritableSpan);
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

function scrubAttributes(span: WritableSpan): void {
  const attributes = span.attributes;
  if (!attributes) return;
  for (const key of Object.keys(attributes)) {
    if (FULLY_REDACTED_KEYS.test(key) || URL_KEYS.test(key)) {
      span.setAttribute(key, scrubValue(key, attributes[key]));
    }
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
 * no-op harmlessly.
 */
type BusinessCounters = {
  registrationsTotal: Counter;
  paymentsTotal: Counter;
  clinicEnrollmentsTotal: Counter;
};

let businessCounters: BusinessCounters | undefined;

function getBusinessCounters(): BusinessCounters {
  if (!businessCounters) {
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
  } catch (error) {
    // Never let telemetry break the app; degraded telemetry is acceptable.
    console.error("OpenTelemetry bootstrap failed:", error);
  }
}
