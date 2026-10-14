import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const account = {
  Id: "001000000000001",
  Name: "Example Workspace Ltd",
  BillingCity: "London",
  BillingCountry: "United Kingdom",
};
const validEnv = {
  SALESFORCE_INSTANCE_URL: "https://example.my.salesforce.com",
  SALESFORCE_ACCESS_TOKEN: "fake-test-token",
};

test("the installed server-only guard rejects imports outside the server condition", () => {
  const loadDependency = createRequire(import.meta.url);
  assert.throws(() => loadDependency("server-only"), /Server Component/);
});

function loadService(env, fetchMock, dateImplementation = Date) {
  const source = fs.readFileSync(new URL("../src/lib/salesforce.ts", import.meta.url), "utf8");
  assert.match(source, /import "server-only";/);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  class FakeEnvHttpProxyAgent {}
  vm.runInNewContext(compiled, {
    exports,
    require: (specifier) => {
      if (specifier === "undici") {
        return { EnvHttpProxyAgent: FakeEnvHttpProxyAgent };
      }
      assert.equal(specifier, "server-only");
      return {};
    },
    process: { env },
    fetch: fetchMock,
    URL,
    URLSearchParams,
    AbortSignal,
    Date: dateImplementation,
  });
  return exports;
}

function jsonPage(records, done = true, nextRecordsUrl) {
  return new Response(JSON.stringify({ records, done, nextRecordsUrl }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("queries Accounts using the server OAuth token and projects only selected fields", async () => {
  const calls = [];
  const service = loadService(validEnv, async (url, options) => {
    calls.push({ url, options });
    return jsonPage([{ ...account, attributes: { type: "Account" }, extraSecret: "private" }]);
  });
  const result = await service.getSalesforceAccounts();
  assert.equal(JSON.stringify(result), JSON.stringify([account]));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, validEnv.SALESFORCE_INSTANCE_URL);
  assert.equal(calls[0].url.pathname, "/services/data/v65.0/query");
  assert.equal(calls[0].url.searchParams.get("q"), "SELECT Id, Name, BillingCity, BillingCountry FROM Account ORDER BY Name, Id");
  assert.equal(calls[0].options.headers.Authorization, "Bearer fake-test-token");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.redirect, "error");
  assert.ok(calls[0].options.signal);
  assert.doesNotMatch(JSON.stringify(result), /fake-test-token|private|attributes/);
});

test("follows Salesforce pagination and respects a configured API version", async () => {
  const calls = [];
  const service = loadService({ ...validEnv, SALESFORCE_API_VERSION: "66.0" }, async (url) => {
    calls.push(url.href);
    return calls.length === 1
      ? jsonPage([account], false, "/services/data/v66.0/query/01g000000000001-2000")
      : jsonPage([{ ...account, Id: "001000000000002", BillingCity: null, BillingCountry: null }]);
  });
  const result = await service.getSalesforceAccounts();
  assert.equal(result.length, 2);
  assert.equal(calls[1], "https://example.my.salesforce.com/services/data/v66.0/query/01g000000000001-2000");
  assert.equal(result[1].BillingCity, null);
});

test("returns an empty array when Salesforce has no readable Accounts", async () => {
  const service = loadService(validEnv, async () => jsonPage([]));
  assert.equal((await service.getSalesforceAccounts()).length, 0);
});

for (const overrides of [
  { SALESFORCE_INSTANCE_URL: undefined },
  { SALESFORCE_ACCESS_TOKEN: undefined },
  { SALESFORCE_INSTANCE_URL: "not-a-url" },
  { SALESFORCE_INSTANCE_URL: "http://example.my.salesforce.com" },
  { SALESFORCE_INSTANCE_URL: "https://user:password@example.my.salesforce.com" },
  { SALESFORCE_INSTANCE_URL: "https://example.my.salesforce.com/?token=private" },
  { SALESFORCE_INSTANCE_URL: "https://example.my.salesforce.com/path" },
  { SALESFORCE_API_VERSION: "65.0/other" },
  { SALESFORCE_ACCESS_TOKEN: "fake\r\nHeader: injected" },
]) {
  test(`rejects invalid configuration without network calls: ${JSON.stringify(overrides)}`, async () => {
    let calls = 0;
    const service = loadService({ ...validEnv, ...overrides }, async () => { calls += 1; });
    await assert.rejects(service.getSalesforceAccounts(), (error) => error.name === "SalesforceApiError");
    assert.equal(calls, 0);
  });
}

for (const status of [401, 403, 429, 500]) {
  test(`sanitizes Salesforce HTTP ${status} errors`, async () => {
    const service = loadService(validEnv, async () => new Response("private token and org details", { status }));
    await assert.rejects(service.getSalesforceAccounts(), (error) => {
      assert.equal(error.name, "SalesforceApiError");
      assert.equal(error.status, status);
      assert.doesNotMatch(error.message, /fake-test-token|private|org details/);
      return true;
    });
  });
}

test("sanitizes network errors without echoing sensitive details", async () => {
  const service = loadService(validEnv, async () => { throw new Error("private fake-test-token"); });
  await assert.rejects(service.getSalesforceAccounts(), /Salesforce request failed or timed out/);
});

for (const payload of [
  "not-json",
  JSON.stringify(null),
  JSON.stringify({ records: [{}], done: true }),
  JSON.stringify({ records: [], done: false }),
]) {
  test(`rejects malformed Account responses: ${payload}`, async () => {
    const service = loadService(validEnv, async () => new Response(payload, { status: 200 }));
    await assert.rejects(service.getSalesforceAccounts(), (error) => error.name === "SalesforceApiError");
  });
}

for (const nextRecordsUrl of [
  "https://attacker.example/services/data/v65.0/query/cursor",
  "//attacker.example/services/data/v65.0/query/cursor",
  "/services/data/v65.0/query/../other",
  "/services/data/v65.0/query/cursor?token=private",
  "/services/data/v65.0/query/cursor#fragment",
  "/services/data/v66.0/query/cursor",
]) {
  test(`rejects unsafe pagination before sending another bearer token: ${nextRecordsUrl}`, async () => {
    let calls = 0;
    const service = loadService(validEnv, async () => {
      calls += 1;
      return jsonPage([account], false, nextRecordsUrl);
    });
    await assert.rejects(service.getSalesforceAccounts(), /invalid pagination cursor/);
    assert.equal(calls, 1);
  });
}

test("rejects repeated pagination cursors instead of looping forever", async () => {
  let calls = 0;
  const service = loadService(validEnv, async () => {
    calls += 1;
    return jsonPage([account], false, "/services/data/v65.0/query/repeated-cursor");
  });
  await assert.rejects(service.getSalesforceAccounts(), /repeated pagination cursor/);
  assert.equal(calls, 2);
});

const workspaceContract = {
  Id: "a00000000000001",
  Account__r: { Name: "Demo Account" },
  Location__c: "Warsaw",
  Desk_Count__c: 24,
  Monthly_Revenue__c: 8400,
  Contract_End_Date__c: "2026-11-12",
};
const contractsEnv = { ...validEnv, SALESFORCE_REVENUE_CURRENCY: "EUR" };

test("maps real workspace contract fields and follows pagination without exposing raw records", async () => {
  let calls = 0;
  const service = loadService(contractsEnv, async (url) => {
    calls += 1;
    if (calls === 1) {
      assert.equal(url.searchParams.get("q"), "SELECT Id, Account__r.Name, Location__c, Desk_Count__c, Monthly_Revenue__c, Contract_End_Date__c FROM Workspace_Contract__c ORDER BY Contract_End_Date__c, Id");
      return jsonPage([{ ...workspaceContract, privateField: "secret" }], false, "/services/data/v65.0/query/contracts-cursor");
    }
    return jsonPage([{ ...workspaceContract, Id: "a00000000000002", Monthly_Revenue__c: 0 }]);
  });
  const result = await service.getSalesforceContracts();
  assert.equal(calls, 2);
  assert.equal(result.length, 2);
  assert.equal(JSON.stringify(result[0]), JSON.stringify({ id: workspaceContract.Id, accountName: "Demo Account", location: "Warsaw", deskCount: 24, monthlyRevenue: 8400, contractEndDate: "2026-11-12" }));
  assert.equal(result[1].monthlyRevenue, 0);
  assert.doesNotMatch(JSON.stringify(result), /secret|privateField|fake-test-token/);
});

test("returns an empty contract portfolio without inventing mock data", async () => {
  const service = loadService(contractsEnv, async () => jsonPage([]));
  assert.equal((await service.getSalesforceContracts()).length, 0);
});

for (const overrides of [
  { Account__r: null }, { Account__r: {} }, { Location__c: null },
  { Desk_Count__c: 0 }, { Desk_Count__c: 1.5 }, { Monthly_Revenue__c: -1 },
  { Monthly_Revenue__c: "8400" }, { Contract_End_Date__c: "2026-02-30" },
  { Contract_End_Date__c: "2026-13-01" }, { Contract_End_Date__c: null },
]) {
  test(`rejects malformed contract data: ${JSON.stringify(overrides)}`, async () => {
    const service = loadService(contractsEnv, async () => jsonPage([{ ...workspaceContract, ...overrides }]));
    await assert.rejects(service.getSalesforceContracts(), (error) => error.name === "SalesforceApiError");
  });
}

test("requires explicit EUR confirmation before any contract request", async () => {
  let calls = 0;
  const service = loadService(validEnv, async () => { calls += 1; });
  await assert.rejects(service.getSalesforceContracts(), /SALESFORCE_REVENUE_CURRENCY/);
  assert.equal(calls, 0);
});

test("validates currency per record in a multi-currency org", async () => {
  const env = { ...contractsEnv, SALESFORCE_MULTI_CURRENCY: "true" };
  const service = loadService(env, async (url) => {
    assert.match(url.searchParams.get("q"), /CurrencyIsoCode/);
    return jsonPage([{ ...workspaceContract, CurrencyIsoCode: "EUR" }]);
  });
  assert.equal((await service.getSalesforceContracts()).length, 1);
  const mixed = loadService(env, async () => jsonPage([{ ...workspaceContract, CurrencyIsoCode: "USD" }]));
  await assert.rejects(mixed.getSalesforceContracts(), /Non-EUR/);
});

for (const [errorCode, expected] of [
  ["INVALID_FIELD", "SALESFORCE_INVALID_FIELD"],
  ["INVALID_TYPE", "SALESFORCE_INVALID_OBJECT"],
  ["INSUFFICIENT_ACCESS", "SALESFORCE_ACCESS_DENIED"],
  ["REQUEST_LIMIT_EXCEEDED", "SALESFORCE_RATE_LIMITED"],
  ["PRIVATE_UNRECOGNIZED_CODE", "SALESFORCE_API_ERROR"],
]) {
  test(`maps only allowlisted upstream error codes: ${errorCode}`, async () => {
    const service = loadService(validEnv, async () => new Response(JSON.stringify([
      { errorCode, message: "fake-test-token private record and org details" },
    ]), { status: 400 }));
    await assert.rejects(service.getSalesforceAccounts(), (error) => {
      assert.equal(error.code, expected);
      assert.equal(error.status, 400);
      assert.doesNotMatch(JSON.stringify(error), /fake-test-token|private record|org details|PRIVATE_UNRECOGNIZED/);
      return true;
    });
  });
}

for (const [causeCode, expected] of [
  ["ECONNRESET", "SALESFORCE_NETWORK_ERROR"],
  ["ENOTFOUND", "SALESFORCE_NETWORK_ERROR"],
  ["SELF_SIGNED_CERT_IN_CHAIN", "SALESFORCE_TLS_ERROR"],
  ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SALESFORCE_TLS_ERROR"],
  ["UND_ERR_CONNECT_TIMEOUT", "SALESFORCE_TIMEOUT"],
]) {
  test(`classifies network failures without leaking causes: ${causeCode}`, async () => {
    const service = loadService(validEnv, async () => {
      throw Object.assign(new Error("private network details fake-test-token"), { cause: { code: causeCode, hostname: "private-host" } });
    });
    await assert.rejects(service.getSalesforceAccounts(), (error) => {
      assert.equal(error.code, expected);
      assert.doesNotMatch(JSON.stringify(error), /fake-test-token|private-host|private network/);
      return true;
    });
  });
}

test("classifies timeout and non-JSON proxy authentication errors", async () => {
  const timeout = loadService(validEnv, async () => { throw Object.assign(new Error("private"), { name: "TimeoutError" }); });
  await assert.rejects(timeout.getSalesforceAccounts(), (error) => error.code === "SALESFORCE_TIMEOUT");
  const proxy = loadService(validEnv, async () => new Response("private proxy page", { status: 407 }));
  await assert.rejects(proxy.getSalesforceAccounts(), (error) => error.code === "SALESFORCE_PROXY_ERROR" && error.status === 407);
});

test("recognizes a proxy CONNECT 407 without exposing the proxy error text", async () => {
  const service = loadService(validEnv, async () => {
    throw Object.assign(new Error("private"), { cause: { code: "UND_ERR_ABORTED", message: "Proxy response (407) private proxy details" } });
  });
  await assert.rejects(service.getSalesforceAccounts(), (error) => {
    assert.equal(error.code, "SALESFORCE_PROXY_ERROR");
    assert.doesNotMatch(JSON.stringify(error), /private|proxy details/);
    return true;
  });
});

test("direct mode keeps native fetch without a proxy dispatcher", async () => {
  const service = loadService(validEnv, async (_, options) => {
    assert.equal(options.dispatcher, undefined);
    return jsonPage([account]);
  });
  assert.equal((await service.getSalesforceAccounts()).length, 1);
});

for (const proxyName of ["HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy"]) {
  test(`uses the environment proxy dispatcher when ${proxyName} is configured`, async () => {
    const dispatchers = [];
    const service = loadService({ ...validEnv, [proxyName]: "http://proxy.example:8080" }, async (_, options) => {
      assert.ok(options.dispatcher);
      dispatchers.push(options.dispatcher);
      return dispatchers.length === 1
        ? jsonPage([account], false, "/services/data/v65.0/query/proxy-cursor")
        : jsonPage([account]);
    });
    assert.equal((await service.getSalesforceAccounts()).length, 2);
    assert.equal(dispatchers[0], dispatchers[1]);
  });
}

const oauthEnv = {
  SALESFORCE_INSTANCE_URL: "https://example.my.salesforce.com",
  SALESFORCE_CLIENT_ID: "fake-client-id",
  SALESFORCE_CLIENT_SECRET: "fake-client-secret",
};

function oauthResponse(token = "fake-oauth-token", instanceUrl = "https://example.my.salesforce.com", extra = {}) {
  return new Response(JSON.stringify({ access_token: token, instance_url: instanceUrl, token_type: "Bearer", ...extra }), { status: 200 });
}

test("obtains OAuth token server-side, uses returned instance, and caches it without exposing credentials", async () => {
  let tokenCalls = 0;
  let queries = 0;
  const service = loadService({ ...oauthEnv, SALESFORCE_ACCESS_TOKEN: "stale-manual-token", HTTPS_PROXY: "http://proxy.example:8080" }, async (url, options) => {
    if (url.pathname === "/services/oauth2/token") {
      tokenCalls += 1;
      assert.equal(url.origin, oauthEnv.SALESFORCE_INSTANCE_URL);
      assert.equal(url.search, "");
      assert.equal(options.method, "POST");
      assert.equal(options.headers["Content-Type"], "application/x-www-form-urlencoded");
      const body = new URLSearchParams(options.body);
      assert.equal(body.get("grant_type"), "client_credentials");
      assert.equal(body.get("client_id"), "fake-client-id");
      assert.equal(body.get("client_secret"), "fake-client-secret");
      assert.ok(options.dispatcher);
      assert.equal(options.redirect, "error");
      assert.equal(options.cache, "no-store");
      return oauthResponse("fake-oauth-token", "https://other.my.salesforce.com");
    }
    queries += 1;
    assert.equal(url.origin, "https://other.my.salesforce.com");
    assert.equal(options.headers.Authorization, "Bearer fake-oauth-token");
    return jsonPage([account]);
  });
  const results = await Promise.all([service.getSalesforceAccounts(), service.getSalesforceAccounts()]);
  await service.getSalesforceAccounts();
  assert.equal(tokenCalls, 1);
  assert.equal(queries, 3);
  assert.doesNotMatch(JSON.stringify(results), /fake-client|fake-oauth|stale-manual/);
});

test("refreshes token once on 401 and retries the same query", async () => {
  let tokens = 0;
  let queries = 0;
  const service = loadService(oauthEnv, async (url, options) => {
    if (url.pathname === "/services/oauth2/token") return oauthResponse(`token-${++tokens}`);
    queries += 1;
    if (queries === 1) return new Response("private", { status: 401 });
    assert.equal(options.headers.Authorization, "Bearer token-2");
    return jsonPage([account]);
  });
  assert.equal((await service.getSalesforceAccounts()).length, 1);
  assert.equal(tokens, 2);
  assert.equal(queries, 2);
});

test("does not retry 401 indefinitely or refresh a manual access token", async () => {
  let tokens = 0;
  let queries = 0;
  const service = loadService(oauthEnv, async (url) => {
    if (url.pathname === "/services/oauth2/token") return oauthResponse(`token-${++tokens}`);
    queries += 1;
    return new Response("private", { status: 401 });
  });
  await assert.rejects(service.getSalesforceAccounts(), (error) => error.code === "SALESFORCE_TOKEN_EXPIRED");
  assert.equal(tokens, 2);
  assert.equal(queries, 2);
  let manualCalls = 0;
  const manual = loadService(validEnv, async () => { manualCalls += 1; return new Response("private", { status: 401 }); });
  await assert.rejects(manual.getSalesforceAccounts(), (error) => error.status === 401);
  assert.equal(manualCalls, 1);
});

test("renews the cache before expires_in and after the default five-minute lifetime", async () => {
  for (const expiresIn of [undefined, 60]) {
    let now = 0;
    class TestDate extends Date { static now() { return now; } }
    let tokens = 0;
    const service = loadService(oauthEnv, async (url) => url.pathname === "/services/oauth2/token"
      ? oauthResponse(`token-${++tokens}`, oauthEnv.SALESFORCE_INSTANCE_URL, expiresIn === undefined ? {} : { expires_in: expiresIn })
      : jsonPage([account]), TestDate);
    await service.getSalesforceAccounts();
    now = expiresIn === undefined ? 299999 : 53999;
    await service.getSalesforceAccounts();
    assert.equal(tokens, 1);
    now += 2;
    await service.getSalesforceAccounts();
    assert.equal(tokens, 2);
  }
});

test("refreshes on a later pagination page while preserving results", async () => {
  let tokens = 0;
  let cursorCalls = 0;
  const service = loadService(oauthEnv, async (url) => {
    if (url.pathname === "/services/oauth2/token") return oauthResponse(`token-${++tokens}`);
    if (url.pathname.endsWith("/query")) return jsonPage([account], false, "/services/data/v65.0/query/oauth-cursor");
    cursorCalls += 1;
    return cursorCalls === 1 ? new Response("private", { status: 401 }) : jsonPage([{ ...account, Id: "001000000000002" }]);
  });
  assert.equal((await service.getSalesforceAccounts()).length, 2);
  assert.equal(tokens, 2);
  assert.equal(cursorCalls, 2);
});

test("partial OAuth credentials fail closed even if a manual token exists", async () => {
  for (const overrides of [{ SALESFORCE_CLIENT_ID: "fake-client" }, { SALESFORCE_CLIENT_SECRET: "fake-secret" }]) {
    let calls = 0;
    const service = loadService({ ...validEnv, ...overrides }, async () => { calls += 1; });
    await assert.rejects(service.getSalesforceAccounts(), (error) => error.code === "SALESFORCE_CONFIGURATION_ERROR");
    assert.equal(calls, 0);
  }
});

test("parallel 401 responses share one token renewal", async () => {
  let tokens = 0;
  const service = loadService(oauthEnv, async (url, options) => {
    if (url.pathname === "/services/oauth2/token") return oauthResponse(`token-${++tokens}`);
    return options.headers.Authorization === "Bearer token-1"
      ? new Response("private", { status: 401 }) : jsonPage([account]);
  });
  const results = await Promise.all([service.getSalesforceAccounts(), service.getSalesforceAccounts()]);
  assert.equal(tokens, 2);
  assert.ok(results.every((records) => records.length === 1));
});

test("failed token requests are not cached and the next call can recover", async () => {
  let tokens = 0;
  const service = loadService(oauthEnv, async (url) => {
    if (url.pathname === "/services/oauth2/token") {
      tokens += 1;
      return tokens === 1 ? new Response("private", { status: 400 }) : oauthResponse();
    }
    return jsonPage([account]);
  });
  await assert.rejects(service.getSalesforceAccounts(), (error) => error.code === "SALESFORCE_AUTH_FAILED");
  assert.equal((await service.getSalesforceAccounts()).length, 1);
  assert.equal(tokens, 2);
});

test("changing client credentials invalidates the session cache", async () => {
  const env = { ...oauthEnv };
  let tokens = 0;
  const service = loadService(env, async (url) => url.pathname === "/services/oauth2/token"
    ? oauthResponse(`token-${++tokens}`) : jsonPage([account]));
  await service.getSalesforceAccounts();
  env.SALESFORCE_CLIENT_SECRET = "fake-rotated-secret";
  await service.getSalesforceAccounts();
  assert.equal(tokens, 2);
});

test("rejects malformed OAuth JSON without issuing a data query", async () => {
  for (const responseBody of ["not-json", "null", "[]", "{}"] ) {
    let calls = 0;
    const service = loadService(oauthEnv, async () => { calls += 1; return new Response(responseBody); });
    await assert.rejects(service.getSalesforceAccounts(), (error) => error.code === "SALESFORCE_INVALID_RESPONSE");
    assert.equal(calls, 1);
  }
});

for (const status of [400, 401, 403, 407, 500]) {
  test(`sanitizes token-endpoint failure ${status} and does not query records`, async () => {
    let calls = 0;
    const service = loadService(oauthEnv, async () => { calls += 1; return new Response('fake-client-secret private upstream', { status }); });
    await assert.rejects(service.getSalesforceAccounts(), (error) => {
      assert.equal(error.code, status === 407 ? "SALESFORCE_PROXY_ERROR" : "SALESFORCE_AUTH_FAILED");
      assert.doesNotMatch(JSON.stringify(error), /fake-client|private upstream/);
      return true;
    });
    assert.equal(calls, 1);
  });
}

for (const overrides of [
  { access_token: "" }, { access_token: "token\r\ninjected" }, { token_type: "Basic" },
  { instance_url: "https://attacker.example" }, { instance_url: "http://example.my.salesforce.com" },
  { instance_url: "https://user:secret@example.my.salesforce.com" }, { instance_url: "https://example.my.salesforce.com/?token=private" },
  { expires_in: -1 }, { expires_in: "not-a-number" },
]) {
  test(`rejects unsafe OAuth response: ${JSON.stringify(overrides)}`, async () => {
    let calls = 0;
    const service = loadService(oauthEnv, async () => { calls += 1; return oauthResponse("token", oauthEnv.SALESFORCE_INSTANCE_URL, overrides); });
    await assert.rejects(service.getSalesforceAccounts(), (error) => error.code === "SALESFORCE_INVALID_RESPONSE");
    assert.equal(calls, 1);
  });
}