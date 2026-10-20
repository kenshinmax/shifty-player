import { describe, expect, it } from "vitest";
import { slugify, validateSlug } from "@/lib/slug";

describe("slug rules", () => {
  it("accepts lowercase words joined by dashes", () => {
    expect(validateSlug("bay-hoops")).toBeNull();
    expect(validateSlug("abc")).toBeNull();
    expect(validateSlug("team-2027")).toBeNull();
  });

  it("rejects bad shapes and lengths", () => {
    const shape = "Use 3–40 lowercase letters, numbers and single dashes.";
    expect(validateSlug("ab")).toBe(shape);
    expect(validateSlug("a".repeat(41))).toBe(shape);
    expect(validateSlug("Bay-Hoops")).toBe(shape);
    expect(validateSlug("bay--hoops")).toBe(shape);
    expect(validateSlug("-bay")).toBe(shape);
    expect(validateSlug("bay hoops")).toBe(shape);
  });

  it("rejects reserved words", () => {
    for (const reserved of ["admin", "api", "platform", "account", "signup", "login", "www", "app", "dashboard", "static"]) {
      expect(validateSlug(reserved)).toBe("That URL is reserved.");
    }
  });

  it("suggests a slug from a name", () => {
    expect(slugify("Bay Hoops")).toBe("bay-hoops");
    expect(slugify("  St. Mary's  Elite!! ")).toBe("st-mary-s-elite");
    expect(slugify("A".repeat(60))).toHaveLength(40);
    expect(slugify("Élan Basketball")).toBe("elan-basketball");
  });
});
