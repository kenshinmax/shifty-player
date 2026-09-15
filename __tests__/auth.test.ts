import { afterEach, describe, expect, it } from "vitest";
import {
  canAddPlayer,
  canEdit,
  canManageSessions,
  canViewDashboard,
  canViewPlayerDashboard,
  getPostLoginPath,
  resolveLoginRedirect,
  validateSignupInput,
} from "@/lib/auth";
import {
  authenticateUser,
  registerUser,
  resetAuthStore,
} from "@/lib/db/auth-repository";

describe("auth", () => {
  afterEach(async () => {
    await resetAuthStore();
  });

  it("authenticates demo user and admin accounts", async () => {
    expect(await authenticateUser("user@demo.com", "user")).toMatchObject({
      role: "user",
    });
    expect(await authenticateUser("admin@demo.com", "admin")).toMatchObject({
      role: "admin",
    });
    expect(await authenticateUser("user@demo.com", "wrong")).toBeNull();
  });

  it("gates capabilities by role", async () => {
    const user = await authenticateUser("user@demo.com", "user");
    const admin = await authenticateUser("admin@demo.com", "admin");

    expect(canAddPlayer(null)).toBe(false);
    expect(canAddPlayer(user)).toBe(true);
    expect(canAddPlayer(admin)).toBe(true);

    expect(canEdit(null)).toBe(false);
    expect(canEdit(user)).toBe(false);
    expect(canEdit(admin)).toBe(true);

    expect(canManageSessions(user)).toBe(false);
    expect(canManageSessions(admin)).toBe(true);

    expect(canViewDashboard(user)).toBe(false);
    expect(canViewDashboard(admin)).toBe(true);

    expect(canViewPlayerDashboard(user)).toBe(true);
    expect(canViewPlayerDashboard(admin)).toBe(false);
  });

  it("routes players and admins to the correct post-login path", async () => {
    const user = (await authenticateUser("user@demo.com", "user"))!;
    const admin = (await authenticateUser("admin@demo.com", "admin"))!;
    expect(getPostLoginPath(user)).toBe("/player");
    expect(getPostLoginPath(admin)).toBe("/dashboard");
  });

  it("resolves safe login redirects", async () => {
    const user = (await authenticateUser("user@demo.com", "user"))!;
    expect(resolveLoginRedirect(user, "/player")).toBe("/player");
    expect(resolveLoginRedirect(user, "//evil.com")).toBe("/player");
    expect(resolveLoginRedirect(user, null)).toBe("/player");
  });

  it("registers a new parent account and signs them in via authenticate", async () => {
    expect(
      validateSignupInput({ name: "", email: "a@b.com", password: "pass" }),
    ).toBe("Name is required.");

    const created = await registerUser({
      name: "Sam Parent",
      email: "sam.parent@example.com",
      password: "pass",
    });
    expect(created.error).toBeNull();
    expect(created.user).toMatchObject({
      name: "Sam Parent",
      email: "sam.parent@example.com",
      role: "user",
    });

    expect(await authenticateUser("sam.parent@example.com", "pass")).toMatchObject({
      email: "sam.parent@example.com",
    });

    const duplicate = await registerUser({
      name: "Sam Parent",
      email: "sam.parent@example.com",
      password: "pass",
    });
    expect(duplicate.error).toMatch(/already exists/i);
  });
});
