// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { metrics as otelApi, type MeterProvider } from "@opentelemetry/api";
import { metrics, recordMetricsEvent, renderMetrics, METRICS_CONTENT_TYPE } from "@/lib/metrics";
import { GET } from "@/app/api/metrics/route";
import { POST } from "@/app/api/metrics/events/route";

beforeEach(() => metrics.register.resetMetrics());
afterEach(() => {
  vi.restoreAllMocks();
  otelApi.disable();
});

function businessMetrics(body: string): string {
  // Runtime CPU/memory samples vary per scrape. Compare the business series
  // byte-for-byte, while retaining the real registry and runtime collectors.
  return body.split("\n").filter((line) => /^(# (HELP|TYPE) )?shifty_/.test(line)).join("\n");
}

describe("metrics", () => {
  it("preserves the Prometheus business series and scrape response", async () => {
    recordMetricsEvent("registration_started");
    recordMetricsEvent("payment_succeeded");
    recordMetricsEvent("payment_failed");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(METRICS_CONTENT_TYPE);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const rendered = await response.text();
    expect(rendered).toContain("process_cpu_user_seconds_total");
    expect(businessMetrics(rendered)).toBe([
      "# HELP shifty_registrations_total Total registration checkout starts (continue to payment).",
      "# TYPE shifty_registrations_total counter",
      "shifty_registrations_total 1",
      "# HELP shifty_payments_total Total payment outcomes from parent checkout.",
      "# TYPE shifty_payments_total counter",
      'shifty_payments_total{status="succeeded"} 1',
      'shifty_payments_total{status="failed"} 1',
      "# HELP shifty_clinic_enrollments_total Total successful clinic enrollments after payment.",
      "# TYPE shifty_clinic_enrollments_total counter",
      "shifty_clinic_enrollments_total 1",
    ].join("\n"));
  });

  it("bridges browser events through the existing POST route without user data", async () => {
    const increments: { name: string; value: number; attributes?: unknown }[] = [];
    otelApi.setGlobalMeterProvider({
      getMeter: () => ({
        createCounter: (name: string) => ({
          add: (value: number, attributes?: unknown) => increments.push({ name, value, attributes }),
        }),
      }),
    } as unknown as MeterProvider);
    for (const type of ["registration_started", "payment_succeeded", "payment_failed"]) {
      const response = await POST(new Request("http://localhost/api/metrics/events", {
        method: "POST",
        body: JSON.stringify({ type, email: "synthetic@example.com", playerName: "Synthetic" }),
      }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    }
    expect(increments).toEqual([
      { name: "shifty.registrations", value: 1, attributes: undefined },
      { name: "shifty.payments", value: 1, attributes: { status: "succeeded" } },
      { name: "shifty.clinic_enrollments", value: 1, attributes: undefined },
      { name: "shifty.payments", value: 1, attributes: { status: "failed" } },
    ]);
    expect((await metrics.registrationsTotal.get()).values[0].value).toBe(1);
    expect((await metrics.paymentsTotal.get()).values.map(({ value }) => value)).toEqual([1, 1]);
    expect((await metrics.clinicEnrollmentsTotal.get()).values[0].value).toBe(1);
  });

  it("keeps the events endpoint and Prometheus working if OTel throws", async () => {
    vi.spyOn(otelApi, "getMeter").mockImplementation(() => { throw new Error("Synthetic SDK failure"); });
    const response = await POST(new Request("http://localhost/api/metrics/events", {
      method: "POST",
      body: JSON.stringify({ type: "payment_succeeded" }),
    }));
    expect(response.status).toBe(200);
    expect((await metrics.paymentsTotal.get()).values[0].value).toBe(1);
    expect((await metrics.clinicEnrollmentsTotal.get()).values[0].value).toBe(1);
  });

  it.each(["not-json", '{"type":"unknown"}', "{}"])(
    "rejects invalid event bodies without recording metrics: %s",
    async (body) => {
      const before = businessMetrics(await renderMetrics());
      const response = await POST(new Request("http://localhost/api/metrics/events", { method: "POST", body }));
      expect(response.status).toBe(400);
      expect(businessMetrics(await renderMetrics())).toBe(before);
    },
  );
});
