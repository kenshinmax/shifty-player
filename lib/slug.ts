/** Top-level paths an org slug must never shadow. */
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "platform",
  "account",
  "signup",
  "login",
  "o",
  "www",
  "app",
  "dashboard",
  "static",
  "_next",
];

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateSlug(slug: string): string | null {
  if (slug.length < 3 || slug.length > 40 || !SLUG_PATTERN.test(slug)) {
    return "Use 3–40 lowercase letters, numbers and single dashes.";
  }
  if (RESERVED_SLUGS.includes(slug)) return "That URL is reserved.";
  return null;
}

/** Suggests a slug from an org name, e.g. "Bay Hoops" → "bay-hoops". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}
