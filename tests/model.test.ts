import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  complete,
  examples,
  fill,
  findPrompts,
  merge,
  placeholders,
  validateLibrary,
} from "../src/model";
import { Store } from "../electron/store";
test("unique repeated placeholders and literal replacements", () => {
  const body = "{{ topic }} / {{topic}} / {{other}}";
  assert.deepEqual(placeholders(body), ["topic", "other"]);
  assert.equal(complete(body, { topic: "hello", other: " " }), false);
  assert.equal(fill(body, { topic: "$&", other: "x" }), "$& / $& / x");
  assert.equal(complete("plain", {}), true);
  assert.equal(complete("{{constructor}}", {}), false);
  assert.equal(fill("{{constructor}}", {}), "{{constructor}}");
});
test("search titles, bodies and tags; category/favourite filters; sorts", () => {
  const lib = examples();
  assert.equal(
    findPrompts(lib.prompts, "clearer", "", false, "updated").length,
    1,
  );
  assert.equal(
    findPrompts(lib.prompts, "edge cases", "", false, "updated")[0].category,
    "Coding",
  );
  assert.equal(
    findPrompts(lib.prompts, "meetings", "", false, "updated").length,
    1,
  );
  assert.equal(
    findPrompts(lib.prompts, "", "Writing", true, "updated").length,
    1,
  );
  assert.equal(
    findPrompts(lib.prompts, "", "Coding", true, "updated").length,
    0,
  );
  lib.prompts[3].lastUsedAt = "2030-01-01T00:00:00Z";
  assert.equal(
    findPrompts(lib.prompts, "", "", false, "used")[0].id,
    "starter-4",
  );
  lib.prompts[5].updatedAt = "2031-01-01T00:00:00Z";
  assert.equal(
    findPrompts(lib.prompts, "", "", false, "updated")[0].id,
    "starter-6",
  );
});
test("export/import round trip, merge by ID and reject invalid input", () => {
  const original = examples();
  assert.deepEqual(
    validateLibrary(JSON.parse(JSON.stringify(original))),
    original,
  );
  const incoming = structuredClone(original);
  incoming.prompts[0].title = "Changed";
  assert.equal(merge(original, incoming).prompts.length, 6);
  assert.equal(merge(original, incoming).prompts[0].title, "Changed");
  for (const bad of [
    null,
    {},
    { version: 2, prompts: [] },
    { version: 1, prompts: [{}] },
    { version: 1, prompts: [original.prompts[0], original.prompts[0]] },
    { version: 1, prompts: [{ ...original.prompts[0], lastUsedAt: "bad" }] },
  ])
    assert.throws(() => validateLibrary(bad));
});
test("persistence across store restarts; seed once even after deleting everything", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shelf-test-"));
  try {
    const file = path.join(dir, "library.json");
    const store = new Store(file);
    const lib = await store.load();
    assert.equal(lib.prompts.length, 6);
    lib.prompts[0].title = "Persisted";
    await store.commit(lib);
    assert.equal((await new Store(file).load()).prompts[0].title, "Persisted");
    await store.commit({ version: 1, prompts: [] });
    assert.deepEqual(await new Store(file).load(), { version: 1, prompts: [] });
    assert.deepEqual(await fs.readdir(dir), ["library.json"]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("corrupt storage is preserved and cannot be overwritten", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shelf-corrupt-"));
  try {
    const file = path.join(dir, "library.json");
    await fs.writeFile(file, "{broken");
    const store = new Store(file);
    await assert.rejects(() => store.load(), /preserved/);
    await assert.rejects(() => store.commit(examples()), /unavailable/);
    assert.equal(await fs.readFile(file, "utf8"), "{broken");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("size limit keeps every saved library within the import limit", () => {
  const seed = examples().prompts[0];
  const oversized = {
    version: 1,
    prompts: Array.from({ length: 201 }, (_, i) => ({
      ...seed,
      id: `large-${i}`,
      body: "x".repeat(100000),
    })),
  };
  assert.throws(() => validateLibrary(oversized), /20 MB/);
});
