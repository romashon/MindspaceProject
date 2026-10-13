import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL("package.json", root), "utf8"));
const lock = JSON.parse(fs.readFileSync(new URL("package-lock.json", root), "utf8"));

test("project registry uses public npm without credentials", () => {
  assert.equal(
    fs.readFileSync(new URL(".npmrc", root), "utf8").trim(),
    "registry=https://registry.npmjs.org/",
  );
});

test("lockfile package URLs are portable to Vercel", () => {
  for (const [packagePath, entry] of Object.entries(lock.packages)) {
    if (!entry.resolved) {
      continue;
    }

    const url = new URL(entry.resolved);
    assert.equal(url.origin, "https://registry.npmjs.org", packagePath);
    assert.equal(url.username, "", packagePath);
    assert.equal(url.password, "", packagePath);
    assert.equal(url.search, "", packagePath);
    assert.equal(url.hash, "", packagePath);
    assert.ok(entry.integrity, packagePath);
  }
});

test("lockfile root matches the dependency manifest", () => {
  const rootPackage = lock.packages[""];
  assert.deepEqual(rootPackage.dependencies, manifest.dependencies);
  assert.deepEqual(rootPackage.devDependencies, manifest.devDependencies);
  assert.deepEqual(rootPackage.engines, manifest.engines);
});