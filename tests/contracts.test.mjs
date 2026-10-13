import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const loadDependency = createRequire(import.meta.url);

function loadTypeScript(relativePath, dependencies = {}, env = {}) {
  const filename = fileURLToPath(new URL(relativePath, new URL("../", import.meta.url)));
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const moduleExports = {};

  vm.runInNewContext(compiled, {
    exports: moduleExports,
    require: (specifier) => Object.hasOwn(dependencies, specifier)
      ? dependencies[specifier]
      : loadDependency(specifier),
    process: { env },
    URL,
    Date,
  }, { filename });

  return moduleExports;
}

const calculations = loadTypeScript("src/lib/contract-renewal.ts");
const data = loadTypeScript("src/data/mockContracts.ts");

for (const [contractEndDate, daysRemaining, riskLevel] of [
  ["2026-10-12", -1, "Critical"],
  ["2026-10-13", 0, "Critical"],
  ["2026-11-11", 29, "Critical"],
  ["2026-11-12", 30, "Warning"],
  ["2027-01-11", 90, "Warning"],
  ["2027-01-12", 91, "Healthy"],
]) {
  test(`${daysRemaining} days remaining is ${riskLevel}`, () => {
    for (const time of ["00:00:00.000", "23:59:59.999"]) {
      const result = calculations.calculateContractDerivedFields(
        contractEndDate,
        new Date(`2026-10-13T${time}Z`),
      );
      assert.equal(result.daysRemaining, daysRemaining);
      assert.equal(result.riskLevel, riskLevel);
    }
  });
}

test("calendar calculations account for leap days and timezone offsets", () => {
  const leapDay = calculations.calculateContractDerivedFields("2028-03-01", new Date("2028-02-28T12:00:00Z"));
  assert.equal(leapDay.daysRemaining, 2);
  const offset = calculations.calculateContractDerivedFields("2026-11-12", new Date("2026-10-14T01:00:00+02:00"));
  assert.equal(offset.daysRemaining, 30);
});

for (const configuredUrl of [
  undefined,
  "not-a-url",
  "http://example.my.salesforce.com",
]) {
  test(`missing or invalid instance URL returns null: ${configuredUrl}`, async () => {
    const route = loadTypeScript("src/app/api/contracts/route.ts", {
      "@/data/mockContracts": data,
      "@/lib/contract-renewal": calculations,
    }, { SALESFORCE_INSTANCE_URL: configuredUrl });
    const response = route.GET();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).instanceUrl, null);
  });
}

test("GET returns mock contracts and calculated fields without leaking credentials", async () => {
  const route = loadTypeScript("src/app/api/contracts/route.ts", {
    "@/data/mockContracts": data,
    "@/lib/contract-renewal": calculations,
  }, {
    SALESFORCE_INSTANCE_URL: "https://user:private-password@example.my.salesforce.com/private-path?token=private-query#private-fragment",
    SALESFORCE_ACCESS_TOKEN: "private-access-token",
  });
  const response = route.GET();
  const body = await response.json();

  assert.equal(route.dynamic, "force-dynamic");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.instanceUrl, "https://example.my.salesforce.com");
  assert.deepEqual(Object.keys(body).sort(), ["contracts", "instanceUrl"]);
  assert.equal(body.contracts.length, data.mockContracts.length);

  for (const [index, contract] of body.contracts.entries()) {
    assert.equal(contract.id, data.mockContracts[index].id);
    assert.ok(Number.isInteger(contract.daysRemaining));
    assert.equal(contract.riskLevel, contract.daysRemaining < 30
      ? "Critical"
      : contract.daysRemaining <= 90 ? "Warning" : "Healthy");
  }

  assert.doesNotMatch(JSON.stringify(body), /private-|user:/);
});