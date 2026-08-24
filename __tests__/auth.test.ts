import { describe, expect, it } from "vitest";
import {
  authenticate,
  canAddPlayer,
  canEdit,
  canManageSessions,
  canViewDashboard,
  canViewPlayerDashboard,
  getPostLoginPath,
} from "@/lib/auth";

describe("auth", () => {
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
});
