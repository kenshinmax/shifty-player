import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const CHECKOUT_ROUTES = [
  "POST /api/stripe/create-payment-intent",
  "POST /api/stripe/confirm-enrollment",
];

function validateEvidence(evidence, enabled) {
  if (
    !evidence || evidence.schemaVersion !== 1 ||
    typeof evidence.environment !== "string" || !evidence.environment ||
    evidence.environment === "production" ||
    typeof evidence.serviceVersion !== "string" || !evidence.serviceVersion ||
    evidence.telemetryEnabled !== enabled || !Array.isArray(evidence.samples)
  ) {
    throw new Error("Invalid evidence metadata. Use matching non-production runs with telemetry off/on.");
  }
  for (const sample of evidence.samples) {
    if (
      !sample || !CHECKOUT_ROUTES.includes(sample.route) ||
      !Number.isFinite(sample.durationMs) || sample.durationMs < 0 ||
      typeof sample.failed !== "boolean"
    ) {
      throw new Error("Invalid checkout sample. Supply a reviewed route, finite nonnegative durationMs, and boolean failed.");
    }
  }
}

export function percentile95(values) {
  if (!values.length) throw new Error("Cannot compute p95 without samples.");
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

/** Compare each checkout endpoint, not just an aggregate that hides regressions. */
export function compareEvidence(baseline, candidate, minSamples = 100) {
  if (!Number.isInteger(minSamples) || minSamples < 1) throw new Error("minSamples must be a positive integer.");
  validateEvidence(baseline, false);
  validateEvidence(candidate, true);
  if (baseline.environment !== candidate.environment || baseline.serviceVersion !== candidate.serviceVersion) {
    throw new Error("Baseline and candidate must use the same environment and application version.");
  }
  const endpoints = CHECKOUT_ROUTES.map((route) => {
    const before = baseline.samples.filter((sample) => sample.route === route);
    const after = candidate.samples.filter((sample) => sample.route === route);
    if (before.length < minSamples || after.length < minSamples) {
      throw new Error("Insufficient evidence for each checkout route. Collect more samples; do not substitute demo or rejected requests.");
    }
    const baselineP95Ms = percentile95(before.map((sample) => sample.durationMs));
    const candidateP95Ms = percentile95(after.map((sample) => sample.durationMs));
    const baselineFailures = before.filter((sample) => sample.failed).length;
    const candidateFailures = after.filter((sample) => sample.failed).length;
    const p95IncreaseMs = candidateP95Ms - baselineP95Ms;
    const errorRateNotIncreased = candidateFailures * before.length <= baselineFailures * after.length;
    return {
      route,
      baselineSamples: before.length,
      candidateSamples: after.length,
      baselineP95Ms,
      candidateP95Ms,
      p95IncreaseMs,
      baselineErrorRate: baselineFailures / before.length,
      candidateErrorRate: candidateFailures / after.length,
      passed: p95IncreaseMs < 5 && errorRateNotIncreased,
    };
  });
  return { passed: endpoints.every((endpoint) => endpoint.passed), minSamples, endpoints };
}

export async function main(args) {
  if (args.length !== 2) throw new Error("Usage: npm run otel:compare -- <baseline.json> <candidate.json>");
  const [baseline, candidate] = await Promise.all(args.map(async (path) => JSON.parse(await readFile(path, "utf8"))));
  const result = compareEvidence(baseline, candidate);
  console.log(JSON.stringify(result, null, 2));
  return result.passed ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch {
    // Never echo file contents, secrets, or raw parse/filesystem errors.
    console.error("Invalid or incomplete evidence. See observability/otel-splunk-runbook.md for the schema and required samples.");
    process.exitCode = 2;
  }
}
