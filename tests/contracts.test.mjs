import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const loadDependency = createRequire(import.meta.url);

function loadTypeScript(relativePath, dependencies = {}, env = {}, globals = {}) {
  const filename = fileURLToPath(new URL(relativePath, new URL("../", import.meta.url)));
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const moduleExports = {};
  const providedDependencies = {
    "@/lib/salesforce": {
      getSalesforceContracts: async () => { throw new Error("Unexpected Salesforce call in mock mode"); },
      SalesforceApiError: Error,
    },
    ...dependencies,
  };

  vm.runInNewContext(compiled, {
    exports: moduleExports,
    require: (specifier) => specifier === "@/lib/salesforce-errors"
      ? loadTypeScript("src/lib/salesforce-errors.ts")
      : Object.hasOwn(providedDependencies, specifier)
        ? providedDependencies[specifier]
        : loadDependency(specifier),
    process: { env },
    URL,
    URLSearchParams,
    AbortSignal,
    Date,
    ...globals,
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
    const response = await route.GET();
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
  const response = await route.GET();
  const body = await response.json();

  assert.equal(route.dynamic, "force-dynamic");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.instanceUrl, "https://example.my.salesforce.com");
  assert.deepEqual(Object.keys(body).sort(), ["contracts", "dataSource", "instanceUrl"]);
  assert.equal(body.dataSource, "mock");
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

const summaries = loadTypeScript("src/features/contracts/summary.ts");

test("summary includes day 30, excludes overdue renewals, and sums Critical and Warning revenue", () => {
  const contracts = [-1, 0, 29, 30, 90, 91].map((daysRemaining, index) => ({
    ...data.mockContracts[0],
    id: `summary-${index}`,
    daysRemaining,
    riskLevel: daysRemaining < 30 ? "Critical" : daysRemaining <= 90 ? "Warning" : "Healthy",
    monthlyRevenue: (index + 1) * 100,
  }));
  const result = summaries.getContractsSummary(contracts);

  assert.equal(result.totalContracts, 6);
  assert.equal(result.expiringSoon, 3);
  assert.equal(result.monthlyRevenueAtRisk, 1500);
});

test("summary returns zeroes for an empty portfolio", () => {
  const result = summaries.getContractsSummary([]);
  assert.equal(result.totalContracts, 0);
  assert.equal(result.expiringSoon, 0);
  assert.equal(result.monthlyRevenueAtRisk, 0);
});

test("mock portfolio summary matches the October 13, 2026 renewal snapshot", () => {
  const contracts = data.mockContracts.map((contract) => ({
    ...contract,
    ...calculations.calculateContractDerivedFields(contract.contractEndDate, new Date("2026-10-13T12:00:00Z")),
  }));
  const result = summaries.getContractsSummary(contracts);

  assert.equal(result.totalContracts, 12);
  assert.equal(result.expiringSoon, 3);
  assert.equal(result.monthlyRevenueAtRisk, 100660);
});

const routeDependencies = {
  "@/data/mockContracts": data,
  "@/lib/contract-renewal": calculations,
};

test("local dev mode returns Salesforce contracts with calculated risk and source label", async () => {
  let calls = 0;
  const route = loadTypeScript("src/app/api/contracts/route.ts", {
    ...routeDependencies,
    "@/lib/salesforce": {
      getSalesforceContracts: async () => { calls += 1; return [{ ...data.mockContracts[0], id: "real-contract" }]; },
      SalesforceApiError: Error,
    },
  }, { CONTRACTS_DATA_SOURCE: "salesforce", NODE_ENV: "development" });
  const response = await route.GET(new Request("http://127.0.0.1:3000/api/contracts"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(calls, 1);
  assert.equal(body.dataSource, "salesforce");
  assert.equal(body.contracts.length, 1);
  assert.equal(body.contracts[0].id, "real-contract");
  assert.ok(Number.isInteger(body.contracts[0].daysRemaining));
});

for (const scenario of [
  { env: { NODE_ENV: "production" }, host: "127.0.0.1" },
  { env: { NODE_ENV: "production", VERCEL: "1" }, host: "demo.vercel.app" },
  { env: { NODE_ENV: "development", VERCEL: "1" }, host: "localhost" },
  { env: { NODE_ENV: "development" }, host: "public.example" },
]) {
  test(`explicit Salesforce source works in deployment environment: ${JSON.stringify(scenario)}`, async () => {
    let calls = 0;
    const route = loadTypeScript("src/app/api/contracts/route.ts", {
      ...routeDependencies,
      "@/lib/salesforce": { getSalesforceContracts: async () => { calls += 1; return []; }, SalesforceApiError: Error },
    }, { CONTRACTS_DATA_SOURCE: "salesforce", ...scenario.env });
    const response = await route.GET(new Request(`http://${scenario.host}/api/contracts`));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).dataSource, "salesforce");
    assert.equal(calls, 1);
  });
}

test("invalid source fails closed instead of quietly using mock data", async () => {
  const route = loadTypeScript("src/app/api/contracts/route.ts", routeDependencies, { CONTRACTS_DATA_SOURCE: "invalid" });
  const response = await route.GET(new Request("http://localhost:3000/api/contracts"));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "INVALID_DATA_SOURCE");
});

test("empty Salesforce org is shown as an empty portfolio, not mock data", async () => {
  const route = loadTypeScript("src/app/api/contracts/route.ts", {
    ...routeDependencies,
    "@/lib/salesforce": { getSalesforceContracts: async () => [], SalesforceApiError: Error },
  }, { CONTRACTS_DATA_SOURCE: "salesforce", NODE_ENV: "development" });
  const body = await (await route.GET(new Request("http://localhost:3000/api/contracts"))).json();
  assert.equal(body.dataSource, "salesforce");
  assert.equal(body.contracts.length, 0);
});

for (const status of [401, 403, undefined]) {
  test(`returns only a safe error code on Salesforce failure: ${status}`, async () => {
    class ApiError extends Error { constructor() { super("private token and upstream details"); this.status = status; } }
    const route = loadTypeScript("src/app/api/contracts/route.ts", {
      ...routeDependencies,
      "@/lib/salesforce": { getSalesforceContracts: async () => { throw new ApiError(); }, SalesforceApiError: ApiError },
    }, { CONTRACTS_DATA_SOURCE: "salesforce", NODE_ENV: "development" });
    const response = await route.GET(new Request("http://localhost:3000/api/contracts"));
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.error, status === 401 ? "SALESFORCE_TOKEN_EXPIRED" : "SALESFORCE_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(body), /private|token and|contracts/);
  });
}

for (const [code, status, expected] of [
  ["SALESFORCE_TIMEOUT", undefined, "SALESFORCE_TIMEOUT"],
  ["SALESFORCE_TLS_ERROR", undefined, "SALESFORCE_TLS_ERROR"],
  ["SALESFORCE_INVALID_FIELD", 400, "SALESFORCE_INVALID_FIELD"],
  ["SALESFORCE_ACCESS_DENIED", 403, "SALESFORCE_ACCESS_DENIED"],
  ["SALESFORCE_CURRENCY_MISMATCH", undefined, "SALESFORCE_CURRENCY_MISMATCH"],
  ["SALESFORCE_AUTH_FAILED", 401, "SALESFORCE_AUTH_FAILED"],
  ["PRIVATE_UNRECOGNIZED_CODE", 500, "SALESFORCE_UNAVAILABLE"],
]) {
  test(`exposes only a safe diagnostic code and numeric status: ${code}`, async () => {
    class ApiError extends Error {
      constructor() { super("private token, query and record details"); this.code = code; this.status = status; }
    }
    const route = loadTypeScript("src/app/api/contracts/route.ts", {
      ...routeDependencies,
      "@/lib/salesforce": { getSalesforceContracts: async () => { throw new ApiError(); }, SalesforceApiError: ApiError },
    }, { CONTRACTS_DATA_SOURCE: "salesforce", NODE_ENV: "development" });
    const response = await route.GET(new Request("http://localhost:3000/api/contracts"));
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error, expected);
    assert.equal(body.salesforceStatus, status);
    assert.deepEqual(Object.keys(body).sort(), status === undefined ? ["error"] : ["error", "salesforceStatus"]);
    assert.doesNotMatch(JSON.stringify(body), /private|query|record details|PRIVATE_UNRECOGNIZED/);
  });
}

test("Vercel without an explicit source stays mock and does not authenticate", async () => {
  const route = loadTypeScript("src/app/api/contracts/route.ts", routeDependencies, { NODE_ENV: "production", VERCEL: "1" });
  const response = await route.GET();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(route.runtime, "nodejs");
  assert.equal(body.dataSource, "mock");
  assert.equal(body.contracts.length, data.mockContracts.length);
});

test("Vercel route obtains a token and returns mapped Salesforce contracts without credentials", async () => {
  const env = {
    NODE_ENV: "production", VERCEL: "1", CONTRACTS_DATA_SOURCE: "salesforce",
    SALESFORCE_INSTANCE_URL: "https://demo.my.salesforce.com",
    SALESFORCE_CLIENT_ID: "fake-client-id", SALESFORCE_CLIENT_SECRET: "fake-client-secret",
    SALESFORCE_REVENUE_CURRENCY: "EUR",
  };
  let tokens = 0;
  let queries = 0;
  const service = loadTypeScript("src/lib/salesforce.ts", {
    "server-only": {}, "undici": { EnvHttpProxyAgent: class {} },
  }, env, {
    fetch: async (url, options) => {
      if (url.pathname === "/services/oauth2/token") {
        tokens += 1;
        assert.equal(new URLSearchParams(options.body).get("client_secret"), "fake-client-secret");
        return new Response(JSON.stringify({ access_token: "fake-auto-token", instance_url: env.SALESFORCE_INSTANCE_URL }));
      }
      queries += 1;
      assert.equal(options.headers.Authorization, "Bearer fake-auto-token");
      return new Response(JSON.stringify({ done: true, records: [{
        Id: "real-contract-id", Account__r: { Name: "Demo Account" }, Location__c: "Warsaw",
        Desk_Count__c: 24, Monthly_Revenue__c: 8400, Contract_End_Date__c: "2027-01-12",
      }] }));
    },
  });
  const route = loadTypeScript("src/app/api/contracts/route.ts", { ...routeDependencies, "@/lib/salesforce": service }, env);
  for (const request of [1, 2]) {
    const response = await route.GET();
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.dataSource, "salesforce");
    assert.equal(body.contracts[0].id, "real-contract-id");
    assert.equal(body.contracts[0].accountName, "Demo Account");
    assert.ok(Number.isInteger(body.contracts[0].daysRemaining));
    assert.doesNotMatch(JSON.stringify(body), /fake-auto-token|fake-client|access_token|client_secret/);
    assert.equal(queries, request);
  }
  assert.equal(tokens, 1);
});