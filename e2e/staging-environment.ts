/** Remote e2e resets and creates data. Require an explicit, exact target opt-in. */
export function getDisposableStagingOrigin(env: Record<string, string | undefined>): string {
  if (!env.E2E_BASE_URL) throw new Error("Set E2E_BASE_URL to a disposable staging origin.");
  let url: URL;
  try {
    url = new URL(env.E2E_BASE_URL);
  } catch {
    throw new Error("E2E_BASE_URL must be an HTTP(S) origin without credentials.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) ||
    url.username || url.password || url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("Use an HTTPS staging origin without credentials, a path, query, or fragment.");
  }
  if (env.E2E_ALLOW_DATA_RESET !== "true" || env.E2E_DISPOSABLE_ORIGIN !== url.origin) {
    throw new Error("Remote tests reset data. Set E2E_ALLOW_DATA_RESET=true and E2E_DISPOSABLE_ORIGIN to the exact target origin.");
  }
  return url.origin;
}
