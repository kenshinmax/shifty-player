import { afterEach, describe, expect, it } from "vitest";
import {
  metrics as otelApi,
  type Attributes,
  type Counter,
  type MeterProvider,
  type Span,
} from "@opentelemetry/api";
import type { ReadableSpan } from "@opentelemetry/sdk-trace";
import { SanitizingSpanProcessor, isOtelEnabled, startOtel } from "@/lib/otel";
import { recordMetricsEvent } from "@/lib/metrics";

type SpanCalls = { key: string; value: string | number | boolean }[];

function fakeSpan(attributes: Attributes): { span: Span; setCalls: SpanCalls } {
  const setCalls: SpanCalls = [];
  const span = {
    attributes,
    setAttribute: (key: string, value: string | number | boolean) => {
      setCalls.push({ key, value });
      attributes[key] = value;
    },
  };
  return { span: span as unknown as Span, setCalls };
}

const OTEL_ENV_KEYS = ["OTEL_ENABLED", "OTEL_EXPORTER_OTLP_ENDPOINT"];

afterEach(() => {
  for (const key of OTEL_ENV_KEYS) delete process.env[key];
});

describe("isOtelEnabled", () => {
  it("is disabled unless enabled and an endpoint are both configured", () => {
    process.env.OTEL_ENABLED = "true";
    expect(isOtelEnabled()).toBe(false);

    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "https://ingest.example.com:4317";
    expect(isOtelEnabled()).toBe(true);

    process.env.OTEL_ENABLED = "false";
    expect(isOtelEnabled()).toBe(false);
  });
});

describe("startOtel", () => {
  it("no-ops when telemetry is disabled", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "https://ingest.example.com:4317";
    // OTEL_ENABLED unset: must resolve without starting the distribution.
    await expect(startOtel()).resolves.toBeUndefined();
  });
});

describe("metrics bridge", () => {
  it("records business events on OTel counters with attributes", () => {
    // The metrics API resolves the global provider at counter-creation time
    // (no proxy like tracing), so a provider must be set before the first
    // event. This mirrors production, where register() awaits startOtel()
    // before any traffic.
    class RecordingCounter implements Counter {
      calls: { value: number; attributes?: Attributes }[] = [];
      add(value: number, attributes?: Attributes) {
        this.calls.push({ value, attributes });
      }
    }
    class RecordingMeter {
      counters = new Map<string, RecordingCounter>();
      createCounter(name: string) {
        if (!this.counters.has(name)) this.counters.set(name, new RecordingCounter());
        return this.counters.get(name) as RecordingCounter;
      }
    }
    const meter = new RecordingMeter();
    otelApi.setGlobalMeterProvider({
      getMeter: () => meter,
    } as unknown as MeterProvider);

    recordMetricsEvent("registration_started");
    recordMetricsEvent("payment_succeeded");
    recordMetricsEvent("payment_failed");

    expect(meter.counters.get("shifty.registrations")?.calls).toEqual([
      { value: 1, attributes: undefined },
    ]);
    expect(meter.counters.get("shifty.payments")?.calls).toEqual([
      { value: 1, attributes: { status: "succeeded" } },
      { value: 1, attributes: { status: "failed" } },
    ]);
    expect(meter.counters.get("shifty.clinic_enrollments")?.calls).toEqual([
      { value: 1, attributes: undefined },
    ]);

    otelApi.disable();
  });
});

describe("SanitizingSpanProcessor", () => {
  const sensitiveAttributes = {
    "http.url":
      "https://api.stripe.com/v1/payment_intents?email=parent@example.com",
    "http.target": "/api/orgs/o1/players?name=Jimmy",
    "http.request.header.authorization": "Bearer sk_test_123",
    "url.query": "email=parent@example.com",
    "db.statement": '{"find":"players","filter":{"name":"Jimmy"}}',
  };
  const safeAttributes = {
    "http.route": "/api/orgs/o1/players",
    "http.request.method": "POST",
    "db.name": "shifty",
    "db.operation": "find",
  };

  it("redacts sensitive attributes at span start", () => {
    const processor = new SanitizingSpanProcessor();
    const { span, setCalls } = fakeSpan({
      ...sensitiveAttributes,
      ...safeAttributes,
    });

    processor.onStart(span);

    expect(setCalls).toEqual(
      expect.arrayContaining([
        {
          key: "http.url",
          value: "https://api.stripe.com/v1/payment_intents",
        },
        { key: "http.target", value: "/api/orgs/o1/players" },
        { key: "http.request.header.authorization", value: "[REDACTED]" },
        { key: "url.query", value: "[REDACTED]" },
        { key: "db.statement", value: "[REDACTED]" },
      ]),
    );
    // Safe attributes are untouched.
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({ key: "http.route" }),
    );
    expect(setCalls).not.toContainEqual(
      expect.objectContaining({ key: "db.name" }),
    );
  });

  it("scrubs again at span end for attributes set after start", () => {
    const processor = new SanitizingSpanProcessor();
    const { span, setCalls } = fakeSpan({ ...safeAttributes });

    processor.onStart(span);
    expect(setCalls).toHaveLength(0);

    (span as unknown as { attributes: Attributes }).attributes[
      "http.response.header.set-cookie"
    ] = "session=abc123";
    processor.onEnd(span as unknown as ReadableSpan);

    expect(setCalls).toContainEqual({
      key: "http.response.header.set-cookie",
      value: "[REDACTED]",
    });
  });

  it("resolves flush and shutdown without work", async () => {
    const processor = new SanitizingSpanProcessor();
    await expect(processor.forceFlush()).resolves.toBeUndefined();
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});
