import type { MetricsEventType } from "@/lib/metrics-client";
import {
  Counter,
  Registry,
  collectDefaultMetrics,
  prometheusContentType,
} from "prom-client";

const globalForMetrics = globalThis as typeof globalThis & {
  __shiftyMetrics?: {
    register: Registry;
    registrationsTotal: Counter;
    paymentsTotal: Counter<"status">;
    clinicEnrollmentsTotal: Counter;
  };
};

function createMetrics() {
  const register = new Registry();
  collectDefaultMetrics({ register });

  const registrationsTotal = new Counter({
    name: "shifty_registrations_total",
    help: "Total registration checkout starts (continue to payment).",
    registers: [register],
  });

  const paymentsTotal = new Counter({
    name: "shifty_payments_total",
    help: "Total payment outcomes from parent checkout.",
    labelNames: ["status"] as const,
    registers: [register],
  });

  const clinicEnrollmentsTotal = new Counter({
    name: "shifty_clinic_enrollments_total",
    help: "Total successful clinic enrollments after payment.",
    registers: [register],
  });

  return {
    register,
    registrationsTotal,
    paymentsTotal,
    clinicEnrollmentsTotal,
  };
}

export const metrics = globalForMetrics.__shiftyMetrics ?? createMetrics();

if (process.env.NODE_ENV !== "production") {
  globalForMetrics.__shiftyMetrics = metrics;
}

export const METRICS_CONTENT_TYPE = prometheusContentType;

export function recordMetricsEvent(type: MetricsEventType): void {
  switch (type) {
    case "registration_started":
      metrics.registrationsTotal.inc();
      break;
    case "payment_succeeded":
      metrics.paymentsTotal.inc({ status: "succeeded" });
      metrics.clinicEnrollmentsTotal.inc();
      break;
    case "payment_failed":
      metrics.paymentsTotal.inc({ status: "failed" });
      break;
  }
}

export async function renderMetrics(): Promise<string> {
  return metrics.register.metrics();
}
