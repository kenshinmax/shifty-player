// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  metrics as otelApi,
  SpanStatusCode,
  type Attributes,
  type MeterProvider,
} from "@opentelemetry/api";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from "@opentelemetry/sdk-trace";
import { SanitizingSpanProcessor, isOtelEnabled, startOtel } from "@/lib/otel";
import { recordMetricsEvent } from "@/lib/metrics";

const { start } = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("@splunk/otel", () => ({ start }));
vi.mock("@splunk/otel/lib/tracing/options", () => ({
  defaultSpanProcessorFactory: () => [],
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  otelApi.disable();
  start.mockReset();
  delete (globalThis as { __shiftyOtelStarted?: boolean }).__shiftyOtelStarted;
});

describe("isOtelEnabled", () => {
  it("is disabled unless enabled and an endpoint are both configured", () => {
    vi.stubEnv("OTEL_ENABLED", "true");
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "");
    expect(isOtelEnabled()).toBe(false);
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector.example:4318");
    expect(isOtelEnabled()).toBe(true);
    vi.stubEnv("OTEL_ENABLED", "false");
    expect(isOtelEnabled()).toBe(false);
  });
});

describe("startOtel", () => {
  it("no-ops when telemetry is disabled", async () => {
    vi.stubEnv("OTEL_ENABLED", "");
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector.example:4318");
    await expect(startOtel()).resolves.toBeUndefined();
    expect(start).not.toHaveBeenCalled();
  });

  it("does not expose configuration in bootstrap errors", async () => {
    vi.stubEnv("OTEL_ENABLED", "true");
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector.example:4318");
    start.mockImplementation(() => { throw new Error("Synthetic credential in SDK error"); });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(startOtel()).resolves.toBeUndefined();
    expect(log.mock.calls).toEqual([["OpenTelemetry bootstrap failed."]]);
  });
});

describe("metrics bridge", () => {
  it("records all events, including after an earlier no-op provider was used", () => {
    recordMetricsEvent("registration_started");
    const counters = new Map<string, ReturnType<typeof vi.fn>>();
    const createCounter = vi.fn((name: string) => {
      const add = vi.fn();
      counters.set(name, add);
      return { add };
    });
    otelApi.setGlobalMeterProvider({
      getMeter: () => ({ createCounter }),
    } as unknown as MeterProvider);

    recordMetricsEvent("registration_started");
    recordMetricsEvent("payment_succeeded");
    recordMetricsEvent("payment_failed");
    recordMetricsEvent("payment_succeeded");

    expect(createCounter).toHaveBeenCalledTimes(3);
    expect(counters.get("shifty.registrations")?.mock.calls).toEqual([[1]]);
    expect(counters.get("shifty.payments")?.mock.calls).toEqual([
      [1, { status: "succeeded" }],
      [1, { status: "failed" }],
      [1, { status: "succeeded" }],
    ]);
    expect(counters.get("shifty.clinic_enrollments")?.mock.calls).toEqual([[1], [1]]);
  });

  it.each(["meter lookup", "counter creation", "counter increment"])(
    "silently tolerates failures during %s",
    (failure) => {
      const fail = () => { throw new Error("Synthetic telemetry failure"); };
      vi.spyOn(otelApi, "getMeter").mockImplementation(
        failure === "meter lookup" ? fail : () => ({
          createCounter: failure === "counter creation" ? fail : () => ({ add: fail }),
        }) as unknown as ReturnType<typeof otelApi.getMeter>,
      );
      for (const type of ["registration_started", "payment_succeeded", "payment_failed"] as const) {
        expect(() => recordMetricsEvent(type)).not.toThrow();
      }
    },
  );
});

describe("SanitizingSpanProcessor", () => {
  const sensitiveAttributes: Attributes = {
    "http.url": "https://api.stripe.com/v1/payment_intents?email=parent@example.com",
    "http.target": "/api/orgs/o1/players?name=Jimmy",
    "url.full": "https://synthetic-user:synthetic-password@api.stripe.com/v1/payment_intents?client_secret=synthetic#secret",
    "url.path": "/v1/payment_intents",
    "http.request.header.authorization": "Bearer synthetic-secret",
    "http.response.header.set-cookie": "session=synthetic",
    "url.query": "email=parent@example.com",
    "db.statement": '{"find":"players","filter":{"name":"Jimmy"}}',
    "db.query.text": '{"email":"parent@example.com"}',
    "player.name": "Jimmy",
    "customer.email": "parent@example.com",
    "customer.phone": "555-0100",
    "customer.address": "Synthetic street",
    "request.body": '{"name":"Jimmy"}',
    "custom.unreviewed": "sensitive",
  };
  const safeAttributes: Attributes = {
    "http.route": "/api/orgs/[orgId]/players",
    "http.request.method": "POST",
    "http.response.status_code": 200,
    "db.namespace": "shifty",
    "db.operation.name": "find",
    "db.collection.name": "players",
    "stripe.payment_intent.id": "pi_test",
  };
  const sanitizedAttributes = {
    ...Object.fromEntries(Object.keys(sensitiveAttributes).map((key) => [key, "[REDACTED]"])),
    "http.url": "https://api.stripe.com/v1/payment_intents",
    "http.target": "/api/orgs/o1/players",
    "url.full": "https://api.stripe.com/v1/payment_intents",
    "url.path": "/v1/payment_intents",
    ...safeAttributes,
  };

  it.each(["start", "end"])(
    "sanitizes attributes set at span %s before a real SDK export",
    async (when) => {
      const exporter = new InMemorySpanExporter();
      const provider = new TracerProvider({
        spanProcessors: [
          new SanitizingSpanProcessor(),
          new SimpleSpanProcessor({ exporter }),
        ],
      });
      try {
        const attributes = { ...sensitiveAttributes, ...safeAttributes };
        const span = provider.getTracer("privacy-test").startSpan("POST /api/stripe?email=parent@example.com", {
          attributes: when === "start" ? attributes : {},
        });
        if (when === "end") span.setAttributes(attributes);
        span.addEvent("exception", {
          "exception.type": "Error",
          "exception.message": "Failed for parent@example.com",
          "exception.stacktrace": "Error: sensitive customer data",
          "customer.name": "Jimmy",
        });
        span.addLink({
          context: span.spanContext(),
          attributes: { "customer.email": "parent@example.com" },
        });
        span.setStatus({ code: SpanStatusCode.ERROR, message: "parent@example.com" });
        span.end();
        await provider.forceFlush();
        const exported = exporter.getFinishedSpans()[0];
        expect(exported.name).toBe("POST /api/stripe");
        expect(exported.attributes).toEqual(sanitizedAttributes);
        expect(exported.events[0].attributes).toEqual({
          "exception.type": "Error",
          "exception.message": "[REDACTED]",
          "exception.stacktrace": "[REDACTED]",
          "customer.name": "[REDACTED]",
        });
        expect(exported.links[0].attributes).toEqual({ "customer.email": "[REDACTED]" });
        expect(exported.status).toEqual({ code: SpanStatusCode.ERROR, message: "[REDACTED]" });
      } finally {
        await provider.shutdown();
      }
    },
  );

  it("redacts malformed URLs and non-string URL values", () => {
    const attributes: Attributes = { "url.full": "https://[invalid", "http.target": ["sensitive"] };
    new SanitizingSpanProcessor().onStart({ attributes } as unknown as Parameters<SanitizingSpanProcessor["onStart"]>[0]);
    expect(attributes).toEqual({ "url.full": "[REDACTED]", "http.target": "[REDACTED]" });
  });

  it("resolves flush and shutdown without work", async () => {
    const processor = new SanitizingSpanProcessor();
    await expect(processor.forceFlush()).resolves.toBeUndefined();
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});
