import { describe, expect, it } from "vitest";
import { metrics, recordMetricsEvent, renderMetrics } from "@/lib/metrics";

describe("metrics", () => {
  it("records registration and payment counters", async () => {
    const beforeRegistrations = (
      await metrics.registrationsTotal.get()
    ).values[0]?.value;
    const beforePayments = (await metrics.paymentsTotal.get()).values.find(
      (entry) => entry.labels.status === "succeeded",
    )?.value;
    const beforeEnrollments = (
      await metrics.clinicEnrollmentsTotal.get()
    ).values[0]?.value;

    recordMetricsEvent("registration_started");
    recordMetricsEvent("payment_succeeded");
    recordMetricsEvent("payment_failed");

    const afterRegistrations = (
      await metrics.registrationsTotal.get()
    ).values[0]?.value;
    const afterSucceeded = (await metrics.paymentsTotal.get()).values.find(
      (entry) => entry.labels.status === "succeeded",
    )?.value;
    const afterFailed = (await metrics.paymentsTotal.get()).values.find(
      (entry) => entry.labels.status === "failed",
    )?.value;
    const afterEnrollments = (
      await metrics.clinicEnrollmentsTotal.get()
    ).values[0]?.value;

    expect(afterRegistrations).toBe((beforeRegistrations ?? 0) + 1);
    expect(afterSucceeded).toBe((beforePayments ?? 0) + 1);
    expect(afterFailed).toBeGreaterThanOrEqual(1);
    expect(afterEnrollments).toBe((beforeEnrollments ?? 0) + 1);

    const rendered = await renderMetrics();
    expect(rendered).toContain("shifty_registrations_total");
    expect(rendered).toContain("shifty_payments_total");
    expect(rendered).toContain("shifty_clinic_enrollments_total");
  });
});
