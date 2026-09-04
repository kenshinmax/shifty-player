import { afterEach, describe, expect, it } from "vitest";
import {
  authenticate,
  canAddPlayer,
  canEdit,
  canManageSessions,
  canViewDashboard,
  canViewPlayerDashboard,
  getPostLoginPath,
  registerParentAccount,
  resetAccounts,
  resolveLoginRedirect,
  validateSignupInput,
} from "@/lib/auth";

describe("auth", () => {
  afterEach(() => {
    resetAccounts();
  });

  it("authenticates demo user and admin accounts", () => {
    expect(authenticate("user@demo.com", "user")).toMatchObject({
      role: "user",
    });
    expect(authenticate("admin@demo.com", "admin")).toMatchObject({
      role: "admin",
    });
    expect(authenticate("user@demo.com", "wrong")).toBeNull();
  });

  it("gates capabilities by role", () => {
    const user = authenticate("user@demo.com", "user");
    const admin = authenticate("admin@demo.com", "admin");

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

  it("routes players and admins to the correct post-login path", () => {
    const user = authenticate("user@demo.com", "user")!;
    const admin = authenticate("admin@demo.com", "admin")!;
    expect(getPostLoginPath(user)).toBe("/player");
    expect(getPostLoginPath(admin)).toBe("/dashboard");
  });

  it("resolves safe login redirects", () => {
    const user = authenticate("user@demo.com", "user")!;
    expect(resolveLoginRedirect(user, "/player")).toBe("/player");
    expect(resolveLoginRedirect(user, "//evil.com")).toBe("/player");
    expect(resolveLoginRedirect(user, null)).toBe("/player");
  });

  it("registers a new parent account and signs them in via authenticate", () => {
    expect(
      validateSignupInput({ name: "", email: "a@b.com", password: "pass" }),
    ).toBe("Name is required.");

    const created = registerParentAccount({
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

    expect(
      authenticate("sam.parent@example.com", "pass"),
    ).toMatchObject({ name: "Sam Parent" });

    expect(
      registerParentAccount({
        name: "Duplicate",
        email: "sam.parent@example.com",
        password: "pass",
      }),
    ).toMatchObject({
      error: "An account with that email already exists.",
    });
  });
});
