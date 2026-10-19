import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const API_DIR = path.resolve(__dirname, "../app/api");
const FORBIDDEN = ["@/lib/mongo", "getDb(", ".collection(", "@/lib/db/doc-store"];

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("api route boundaries", () => {
  it("no API route touches the database directly", () => {
    const files = routeFiles(API_DIR);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      return FORBIDDEN.filter((needle) => source.includes(needle)).map(
        (needle) => `${path.relative(API_DIR, file)}: ${needle}`,
      );
    });
    expect(offenders).toEqual([]);
  });
});
