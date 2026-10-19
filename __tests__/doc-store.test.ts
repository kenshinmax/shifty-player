import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore, getDocStore, resetMemoryStore } from "@/lib/db/doc-store";

type Doc = { id: string; orgId?: string; x?: number };

const ids = (docs: Doc[]) => docs.map((d) => d.id);

describe("memory doc store", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("find filters by equality, $in and $exists", async () => {
    const store = createMemoryStore({
      programs: [{ id: "a", orgId: "o1" }, { id: "b", orgId: "o2" }, { id: "c" }],
    });
    expect(ids(await store.find<Doc>("programs", { orgId: "o1" }))).toEqual(["a"]);
    expect(ids(await store.find<Doc>("programs", { id: { $in: ["a", "c"] } }))).toEqual(["a", "c"]);
    expect(ids(await store.find<Doc>("programs", { orgId: { $exists: false } }))).toEqual(["c"]);
  });

  it("returned docs are copies", async () => {
    const store = createMemoryStore({ programs: [{ id: "a", x: 1 }] });
    const [doc] = await store.find<Doc>("programs");
    doc.x = 99;
    const [again] = await store.find<Doc>("programs");
    expect(again.x).toBe(1);
  });

  it("insertOne returns false on duplicate unique key", async () => {
    const store = createMemoryStore();
    expect(await store.insertOne("processed_payments", { paymentIntentId: "pi_1" })).toBe(true);
    expect(await store.insertOne("processed_payments", { paymentIntentId: "pi_1" })).toBe(false);
  });

  it("replaceOne upserts and keeps position", async () => {
    const store = createMemoryStore({ programs: [{ id: "a" }, { id: "b" }] });
    await store.replaceOne("programs", { id: "b" }, { id: "b", x: 1 });
    await store.replaceOne("programs", { id: "z" }, { id: "z" });
    const docs = await store.find<Doc>("programs");
    expect(ids(docs)).toEqual(["a", "b", "z"]);
    expect(docs[1].x).toBe(1);
  });

  it("replaceOne throws when id exists outside the filter", async () => {
    const store = createMemoryStore({ programs: [{ id: "a", orgId: "o1" }] });
    await expect(
      store.replaceOne("programs", { orgId: "o2", id: "a" }, { id: "a", orgId: "o2" }),
    ).rejects.toThrow();
  });

  it("updateMany and deleteMany return counts", async () => {
    const store = createMemoryStore({
      programs: [{ id: "a", orgId: "o1" }, { id: "b", orgId: "o1" }, { id: "c", orgId: "o2" }],
    });
    expect(await store.updateMany("programs", { orgId: "o1" }, { x: 5 })).toBe(2);
    expect((await store.find<Doc>("programs", { x: 5 })).length).toBe(2);
    expect(await store.deleteMany("programs", { orgId: "o1" })).toBe(2);
    expect(await store.count("programs")).toBe(1);
  });

  it("resetMemoryStore replaces getDocStore contents", async () => {
    vi.stubEnv("MONGODB_URI", "");
    resetMemoryStore({ programs: [{ id: "x" }] });
    expect(await getDocStore().count("programs")).toBe(1);
  });
});
