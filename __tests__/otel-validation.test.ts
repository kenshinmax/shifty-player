// @vitest-environment node
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CHECKOUT_ROUTES, compareEvidence, percentile95 } from "@/scripts/compare-otel-validation.mjs";
import { getDisposableStagingOrigin } from "@/e2e/staging-environment";

function evidence(telemetryEnabled: boolean, durationMs = 20) {
  return {
    schemaVersion: 1,
    environment: "staging",
    serviceVersion: "test-release",
    telemetryEnabled,
    samples: CHECKOUT_ROUTES.flatMap((route) =>
      Array.from({ length: 100 }, () => ({ route, durationMs, failed: false })),
    ),
  };
}

describe("checkout rollout comparison", () => {
  it("uses nearest-rank p95 without changing the input order", () => {
    const values = Array.from({ length: 100 }, (_, i) => 100 - i);
    expect(percentile95(values)).toBe(95);
    expect(values[0]).toBe(100);
    expect(() => percentile95([])).toThrow();
  });

  it("passes below 5ms and fails at the exact 5ms boundary", () => {
    expect(compareEvidence(evidence(false), evidence(true, 24.999)).passed).toBe(true);
    expect(compareEvidence(evidence(false), evidence(true, 25)).passed).toBe(false);
  });

  it("fails the worst endpoint even when aggregate latency improves", () => {
    const candidate = evidence(true, 1);
    candidate.samples.filter((s) => s.route === CHECKOUT_ROUTES[0]).forEach((s) => { s.durationMs = 26; });
    const result = compareEvidence(evidence(false), candidate);
    expect(result.passed).toBe(false);
    expect(result.endpoints.map((endpoint) => endpoint.passed)).toEqual([false, true]);
  });

  it("fails any increase in checkout error rate", () => {
    const candidate = evidence(true);
    candidate.samples[0].failed = true;
    expect(compareEvidence(evidence(false), candidate).passed).toBe(false);
  });

  it("compares rates rather than raw failure counts", () => {
    const baseline = evidence(false);
    baseline.samples[0].failed = true;
    const candidate = evidence(true);
    candidate.samples[0].failed = true;
    candidate.samples = [...candidate.samples, ...candidate.samples.map((sample) => ({ ...sample }))];
    expect(compareEvidence(baseline, candidate).passed).toBe(true);
  });

  it.each([-1, NaN, Infinity])("rejects invalid durations: %s", (value) => {
    const candidate = evidence(true);
    candidate.samples[0].durationMs = value;
    expect(() => compareEvidence(evidence(false), candidate)).toThrow();
  });

  it("rejects missing endpoints and too few samples", () => {
    const candidate = evidence(true);
    candidate.samples.pop();
    expect(() => compareEvidence(evidence(false), candidate)).toThrow(/Insufficient/);
    candidate.samples = [];
    expect(() => compareEvidence(evidence(false), candidate)).toThrow(/Insufficient/);
  });

  it("rejects mismatched releases, environments, and telemetry settings", () => {
    expect(() => compareEvidence(evidence(false), { ...evidence(true), serviceVersion: "other" })).toThrow();
    expect(() => compareEvidence(evidence(false), { ...evidence(true), environment: "other" })).toThrow();
    expect(() => compareEvidence(evidence(false), evidence(false))).toThrow();
    expect(() => compareEvidence({ ...evidence(false), environment: "production" }, evidence(true))).toThrow();
  });

  it("executes the delivered CLI with exit codes for pass, fail, and invalid evidence", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "shifty-otel-"));
    const script = path.resolve("scripts/compare-otel-validation.mjs");
    const baseline = path.join(dir, "baseline.json");
    const candidate = path.join(dir, "candidate.json");
    try {
      writeFileSync(baseline, JSON.stringify(evidence(false)));
      writeFileSync(candidate, JSON.stringify(evidence(true)));
      const output = execFileSync(process.execPath, [script, baseline, candidate], { encoding: "utf8" });
      expect(JSON.parse(output).passed).toBe(true);
      writeFileSync(candidate, JSON.stringify(evidence(true, 25)));
      expect(spawnSync(process.execPath, [script, baseline, candidate]).status).toBe(1);
      writeFileSync(candidate, "synthetic-sensitive-invalid-json");
      const invalid = spawnSync(process.execPath, [script, baseline, candidate], { encoding: "utf8" });
      expect(invalid.status).toBe(2);
      expect(invalid.stderr).not.toContain("synthetic-sensitive");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("remote e2e safety gate", () => {
  const env = {
    E2E_BASE_URL: "https://disposable.example.com",
    E2E_DISPOSABLE_ORIGIN: "https://disposable.example.com",
    E2E_ALLOW_DATA_RESET: "true",
  };

  it("accepts only an explicitly acknowledged target", () => {
    expect(getDisposableStagingOrigin(env)).toBe(env.E2E_BASE_URL);
    expect(() => getDisposableStagingOrigin({ ...env, E2E_ALLOW_DATA_RESET: "" })).toThrow();
    expect(() => getDisposableStagingOrigin({ ...env, E2E_DISPOSABLE_ORIGIN: "https://other.example.com" })).toThrow();
    expect(() => getDisposableStagingOrigin({})).toThrow();
  });

  it.each([
    "not-a-url", "http://disposable.example.com",
    "https://user:password@disposable.example.com",
    "https://disposable.example.com/path", "https://disposable.example.com?token=synthetic",
    "https://disposable.example.com#synthetic",
  ])("rejects unsafe target URLs without echoing them", (url) => {
    expect(() => getDisposableStagingOrigin({ ...env, E2E_BASE_URL: url })).toThrow();
    try {
      getDisposableStagingOrigin({ ...env, E2E_BASE_URL: url });
    } catch (error) {
      expect(String(error)).not.toContain(url);
    }
  });
});
