import "server-only";

import { EnvHttpProxyAgent } from "undici";
import type { SalesforceAccount } from "@/types/salesforce";
import type { WorkspaceContract } from "@/types/workspace-contract";
import type { SalesforceErrorCode } from "@/lib/salesforce-errors";

interface SalesforceConfig {
  instanceUrl: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  apiVersion: string;
}

interface SalesforceSession {
  instanceUrl: string;
  accessToken: string;
  expiresAt: number;
}

interface QueryPage<RecordType> {
  records: RecordType[];
  done: boolean;
  nextRecordsUrl?: string;
}

let proxyDispatcher: EnvHttpProxyAgent | undefined;
let cachedSession: { key: string; session: SalesforceSession } | undefined;
let pendingSession: { key: string; promise: Promise<SalesforceSession> } | undefined;

export class SalesforceApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code: SalesforceErrorCode = "SALESFORCE_UNAVAILABLE",
  ) {
    super(message);
    this.name = "SalesforceApiError";
  }
}

function readConfig(): SalesforceConfig {
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL?.trim();
  const accessToken = process.env.SALESFORCE_ACCESS_TOKEN?.trim();
  const clientId = process.env.SALESFORCE_CLIENT_ID?.trim();
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET?.trim();
  const apiVersion = process.env.SALESFORCE_API_VERSION?.trim() || "65.0";

  if (!instanceUrl || (clientId || clientSecret ? !clientId || !clientSecret : !accessToken)) {
    throw new SalesforceApiError("Configure Salesforce instance URL and both Client ID/Secret, or a manual access token.", undefined, "SALESFORCE_CONFIGURATION_ERROR");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(instanceUrl);
  } catch {
    throw new SalesforceApiError("Salesforce instance URL must be a valid HTTPS origin.", undefined, "SALESFORCE_CONFIGURATION_ERROR");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username || parsedUrl.password ||
    parsedUrl.pathname !== "/" || parsedUrl.search || parsedUrl.hash
  ) {
    throw new SalesforceApiError("Salesforce instance URL must be a valid HTTPS origin without credentials or parameters.", undefined, "SALESFORCE_CONFIGURATION_ERROR");
  }

  if (!/^\d{2,3}\.0$/.test(apiVersion) || (!clientId && accessToken && /[\r\n]/.test(accessToken))) {
    throw new SalesforceApiError("Salesforce API version or OAuth token format is invalid.", undefined, "SALESFORCE_CONFIGURATION_ERROR");
  }

  return { instanceUrl: parsedUrl.origin, accessToken, clientId, clientSecret, apiVersion };
}

function isAccount(value: unknown): value is SalesforceAccount {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const account = value as Record<string, unknown>;
  return typeof account.Id === "string" &&
    typeof account.Name === "string" &&
    (account.BillingCity === null || typeof account.BillingCity === "string") &&
    (account.BillingCountry === null || typeof account.BillingCountry === "string");
}

function parsePage<RecordType>(value: unknown, mapRecord: (value: unknown) => RecordType): QueryPage<RecordType> {
  if (typeof value !== "object" || value === null) {
    throw new SalesforceApiError("Salesforce returned an invalid query response.", undefined, "SALESFORCE_INVALID_RESPONSE");
  }

  const page = value as Record<string, unknown>;

  if (
    typeof page.done !== "boolean" ||
    !Array.isArray(page.records) ||
    (!page.done && typeof page.nextRecordsUrl !== "string")
  ) {
    throw new SalesforceApiError("Salesforce returned an invalid query response.", undefined, "SALESFORCE_INVALID_RESPONSE");
  }

  return {
    done: page.done,
    nextRecordsUrl: typeof page.nextRecordsUrl === "string" ? page.nextRecordsUrl : undefined,
    records: page.records.map(mapRecord),
  };
}

async function requestSalesforce(url: URL, init: RequestInit): Promise<Response> {
  let response: Response;

  try {
    const proxyConfigured = Boolean(
      process.env.HTTPS_PROXY || process.env.https_proxy ||
      process.env.HTTP_PROXY || process.env.http_proxy,
    );
    if (proxyConfigured && !proxyDispatcher) {
      proxyDispatcher = new EnvHttpProxyAgent();
    }

    const options: RequestInit & { dispatcher?: EnvHttpProxyAgent } = {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    };
    if (proxyConfigured) {
      options.dispatcher = proxyDispatcher;
    }

    response = await fetch(url, options);
  } catch (error) {
    const failure = error as { name?: unknown; cause?: { code?: unknown; statusCode?: unknown; message?: unknown } } | null;
    const causeCode = failure?.cause?.code;
    let code: SalesforceErrorCode = "SALESFORCE_NETWORK_ERROR";

    if (failure?.cause?.statusCode === 407 ||
      (typeof failure?.cause?.message === "string" && /^Proxy response \(407\)/.test(failure.cause.message))) {
      code = "SALESFORCE_PROXY_ERROR";
    } else if (failure?.name === "TimeoutError" || causeCode === "ETIMEDOUT" || causeCode === "UND_ERR_CONNECT_TIMEOUT") {
      code = "SALESFORCE_TIMEOUT";
    } else if (typeof causeCode === "string" && [
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT",
      "CERT_HAS_EXPIRED", "CERT_UNTRUSTED", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_TLS_CERT_ALTNAME_INVALID",
    ].includes(causeCode)) {
      code = "SALESFORCE_TLS_ERROR";
    }

    throw new SalesforceApiError("Salesforce request failed or timed out.", undefined, code);
  }

  return response;
}

async function createSession(config: SalesforceConfig): Promise<SalesforceSession> {
  const response = await requestSalesforce(new URL("/services/oauth2/token", config.instanceUrl), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId!,
      client_secret: config.clientSecret!,
    }).toString(),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new SalesforceApiError(
      "Salesforce OAuth authentication failed. Check Client ID/Secret and app policies.",
      response.status,
      response.status === 407 ? "SALESFORCE_PROXY_ERROR" : "SALESFORCE_AUTH_FAILED",
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new SalesforceApiError("Salesforce returned invalid OAuth JSON.", undefined, "SALESFORCE_INVALID_RESPONSE");
  }

  const token = body as Record<string, unknown> | null;
  if (
    !token || typeof token !== "object" ||
    typeof token.access_token !== "string" || !token.access_token.trim() || /\s/.test(token.access_token) ||
    typeof token.instance_url !== "string" ||
    (token.token_type !== undefined && (typeof token.token_type !== "string" || token.token_type.toLowerCase() !== "bearer"))
  ) {
    throw new SalesforceApiError("Salesforce returned an invalid OAuth response.", undefined, "SALESFORCE_INVALID_RESPONSE");
  }

  let instance: URL;
  try {
    instance = new URL(token.instance_url);
  } catch {
    throw new SalesforceApiError("Salesforce returned an invalid OAuth instance URL.", undefined, "SALESFORCE_INVALID_RESPONSE");
  }

  if (
    instance.protocol !== "https:" || instance.username || instance.password ||
    instance.pathname !== "/" || instance.search || instance.hash || instance.port ||
    (instance.origin !== config.instanceUrl && !instance.hostname.endsWith(".salesforce.com"))
  ) {
    throw new SalesforceApiError("Salesforce returned an unsafe OAuth instance URL.", undefined, "SALESFORCE_INVALID_RESPONSE");
  }

  let lifetime = 300_000;
  if (token.expires_in !== undefined) {
    const seconds = Number(token.expires_in);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new SalesforceApiError("Salesforce returned an invalid token lifetime.", undefined, "SALESFORCE_INVALID_RESPONSE");
    }
    lifetime = Math.min(lifetime, seconds * 900);
  }

  return { instanceUrl: instance.origin, accessToken: token.access_token, expiresAt: Date.now() + lifetime };
}

async function getSession(config: SalesforceConfig, rejectedToken?: string): Promise<SalesforceSession> {
  if (!config.clientId || !config.clientSecret) {
    return { instanceUrl: config.instanceUrl, accessToken: config.accessToken!, expiresAt: 0 };
  }

  const key = JSON.stringify([config.instanceUrl, config.clientId, config.clientSecret]);
  if (cachedSession?.key === key) {
    if (cachedSession.session.expiresAt > Date.now() && cachedSession.session.accessToken !== rejectedToken) {
      return cachedSession.session;
    }
    cachedSession = undefined;
  }
  if (pendingSession?.key === key) {
    return pendingSession.promise;
  }

  const promise = createSession(config);
  pendingSession = { key, promise };
  try {
    const session = await promise;
    if (pendingSession?.promise === promise) {
      cachedSession = { key, session };
    }
    return session;
  } finally {
    if (pendingSession?.promise === promise) {
      pendingSession = undefined;
    }
  }
}

async function requestPage<RecordType>(url: URL, accessToken: string, mapRecord: (value: unknown) => RecordType): Promise<QueryPage<RecordType>> {
  const response = await requestSalesforce(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  if (!response.ok) {
    const upstreamCodes: Record<string, SalesforceErrorCode> = {
      INVALID_SESSION_ID: "SALESFORCE_TOKEN_EXPIRED",
      INVALID_FIELD: "SALESFORCE_INVALID_FIELD",
      INVALID_TYPE: "SALESFORCE_INVALID_OBJECT",
      INSUFFICIENT_ACCESS: "SALESFORCE_ACCESS_DENIED",
      INSUFFICIENT_ACCESS_OR_READONLY: "SALESFORCE_ACCESS_DENIED",
      API_DISABLED_FOR_ORG: "SALESFORCE_ACCESS_DENIED",
      REQUEST_LIMIT_EXCEEDED: "SALESFORCE_RATE_LIMITED",
    };
    let code: SalesforceErrorCode = response.status === 401
      ? "SALESFORCE_TOKEN_EXPIRED"
      : response.status === 403 ? "SALESFORCE_ACCESS_DENIED"
        : response.status === 407 ? "SALESFORCE_PROXY_ERROR"
          : response.status === 429 ? "SALESFORCE_RATE_LIMITED" : "SALESFORCE_API_ERROR";

    const errors: unknown = await response.json().catch(() => null);
    if (Array.isArray(errors)) {
      const recognized = errors.find((entry) => entry && typeof entry.errorCode === "string" && Object.hasOwn(upstreamCodes, entry.errorCode));
      if (recognized && response.status !== 401 && response.status !== 407) {
        code = upstreamCodes[recognized.errorCode];
      }
    }

    throw new SalesforceApiError(
      response.status === 401
        ? "Salesforce OAuth access token is invalid or expired."
        : "Salesforce data request was rejected.",
      response.status,
      code,
    );
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new SalesforceApiError("Salesforce returned invalid JSON.", undefined, "SALESFORCE_INVALID_RESPONSE");
  }

  return parsePage(body, mapRecord);
}

async function queryRecords<RecordType>(query: string, mapRecord: (value: unknown) => RecordType): Promise<RecordType[]> {
  const config = readConfig();
  let session = await getSession(config);
  let retriedAuthentication = false;
  const queryPath = `/services/data/v${config.apiVersion}/query`;
  let url = new URL(queryPath, session.instanceUrl);
  url.searchParams.set("q", query);
  const records: RecordType[] = [];
  const visited = new Set<string>();

  while (true) {
    if (visited.has(url.href)) {
      throw new SalesforceApiError("Salesforce returned a repeated pagination cursor.", undefined, "SALESFORCE_INVALID_RESPONSE");
    }

    visited.add(url.href);
    let page: QueryPage<RecordType>;
    try {
      page = await requestPage(url, session.accessToken, mapRecord);
    } catch (error) {
      if (!(error instanceof SalesforceApiError) || error.status !== 401 || !config.clientId || retriedAuthentication) {
        throw error;
      }
      retriedAuthentication = true;
      session = await getSession(config, session.accessToken);
      url = new URL(url.pathname + url.search, session.instanceUrl);
      page = await requestPage(url, session.accessToken, mapRecord);
    }
    records.push(...page.records);

    if (page.done) {
      return records;
    }

    const nextPath = page.nextRecordsUrl!;
    const cursor = nextPath.slice(queryPath.length + 1);

    if (!nextPath.startsWith(`${queryPath}/`) || !/^[A-Za-z0-9-]+$/.test(cursor)) {
      throw new SalesforceApiError("Salesforce returned an invalid pagination cursor.", undefined, "SALESFORCE_INVALID_RESPONSE");
    }

    url = new URL(nextPath, session.instanceUrl);
  }
}

export async function getSalesforceAccounts(): Promise<SalesforceAccount[]> {
  return queryRecords(
    "SELECT Id, Name, BillingCity, BillingCountry FROM Account ORDER BY Name, Id",
    (value) => {
      if (!isAccount(value)) {
        throw new SalesforceApiError("Salesforce returned an invalid Account response.", undefined, "SALESFORCE_INVALID_RECORD");
      }

      const { Id, Name, BillingCity, BillingCountry } = value;
      return { Id, Name, BillingCity, BillingCountry };
    },
  );
}

export async function getSalesforceContracts(): Promise<WorkspaceContract[]> {
  if (process.env.SALESFORCE_REVENUE_CURRENCY !== "EUR") {
    throw new SalesforceApiError("Confirm EUR revenue by setting SALESFORCE_REVENUE_CURRENCY=EUR.", undefined, "SALESFORCE_CURRENCY_MISMATCH");
  }

  const currencyMode = process.env.SALESFORCE_MULTI_CURRENCY || "false";
  if (currencyMode !== "true" && currencyMode !== "false") {
    throw new SalesforceApiError("SALESFORCE_MULTI_CURRENCY must be true or false.", undefined, "SALESFORCE_CONFIGURATION_ERROR");
  }

  const multiCurrency = currencyMode === "true";
  const currencyField = multiCurrency ? ", CurrencyIsoCode" : "";

  return queryRecords(
    `SELECT Id, Account__r.Name, Location__c, Desk_Count__c, Monthly_Revenue__c, Contract_End_Date__c${currencyField} FROM Workspace_Contract__c ORDER BY Contract_End_Date__c, Id`,
    (value) => {
      if (typeof value !== "object" || value === null) {
        throw new SalesforceApiError("Salesforce returned an invalid workspace contract.", undefined, "SALESFORCE_INVALID_RECORD");
      }

      const contract = value as Record<string, unknown>;
      const account = contract.Account__r;
      if (
        typeof contract.Id !== "string" || !contract.Id.trim() ||
        typeof account !== "object" || account === null ||
        !("Name" in account) || typeof account.Name !== "string" || !account.Name.trim() ||
        typeof contract.Location__c !== "string" || !contract.Location__c.trim() ||
        typeof contract.Desk_Count__c !== "number" || !Number.isInteger(contract.Desk_Count__c) || contract.Desk_Count__c <= 0 ||
        typeof contract.Monthly_Revenue__c !== "number" || !Number.isFinite(contract.Monthly_Revenue__c) || contract.Monthly_Revenue__c < 0 ||
        typeof contract.Contract_End_Date__c !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(contract.Contract_End_Date__c)
      ) {
        throw new SalesforceApiError("Salesforce returned an invalid workspace contract. Check field access and values.", undefined, "SALESFORCE_INVALID_RECORD");
      }

      const endDate = new Date(`${contract.Contract_End_Date__c}T00:00:00.000Z`);
      if (Number.isNaN(endDate.getTime()) || endDate.toISOString().slice(0, 10) !== contract.Contract_End_Date__c) {
        throw new SalesforceApiError("Salesforce returned an invalid contract end date.", undefined, "SALESFORCE_INVALID_RECORD");
      }

      if (multiCurrency && contract.CurrencyIsoCode !== "EUR") {
        throw new SalesforceApiError("Non-EUR contracts cannot be combined in the EUR dashboard.", undefined, "SALESFORCE_CURRENCY_MISMATCH");
      }

      return {
        id: contract.Id,
        accountName: account.Name,
        location: contract.Location__c,
        deskCount: contract.Desk_Count__c,
        monthlyRevenue: contract.Monthly_Revenue__c,
        contractEndDate: contract.Contract_End_Date__c,
      };
    },
  );
}