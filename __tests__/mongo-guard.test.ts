import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPersistentStore } from "@/lib/mongo";

describe("assertPersistentStore", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("allows the in-memory store outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MONGODB_URI", "");
    expect(() => assertPersistentStore()).not.toThrow();
  });

  it("throws in production without MONGODB_URI", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONGODB_URI", "");
    vi.stubEnv("ALLOW_IN_MEMORY_STORE", "");
    expect(() => assertPersistentStore()).toThrow(/MONGODB_URI is required/);
  });

  it("passes in production when MONGODB_URI is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONGODB_URI", "mongodb://localhost:27017");
    expect(() => assertPersistentStore()).not.toThrow();
  });

  it("honours the explicit override", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONGODB_URI", "");
    vi.stubEnv("ALLOW_IN_MEMORY_STORE", "true");
    expect(() => assertPersistentStore()).not.toThrow();
  });
});
