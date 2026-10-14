import { NextResponse } from "next/server";
import { mockContracts } from "@/data/mockContracts";
import { calculateContractDerivedFields } from "@/lib/contract-renewal";
import { getSalesforceContracts, SalesforceApiError } from "@/lib/salesforce";
import { salesforceErrorMessages } from "@/lib/salesforce-errors";
import type { ContractsApiResponse } from "@/types/workspace-contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getInstanceUrl(): string | null {
  const configuredUrl = process.env.SALESFORCE_INSTANCE_URL;

  if (!configuredUrl) {
    return null;
  }

  try {
    const url = new URL(configuredUrl);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const dataSource = process.env.CONTRACTS_DATA_SOURCE?.trim() || "mock";
  const headers = { "Cache-Control": "no-store" };

  if (dataSource !== "mock" && dataSource !== "salesforce") {
    return NextResponse.json({ error: "INVALID_DATA_SOURCE" }, { status: 503, headers });
  }

  let contracts;
  try {
    contracts = dataSource === "salesforce" ? await getSalesforceContracts() : mockContracts;
  } catch (error) {
    let code = "SALESFORCE_UNAVAILABLE";
    let salesforceStatus: number | undefined;

    if (error instanceof SalesforceApiError) {
      code = Object.hasOwn(salesforceErrorMessages, error.code) ? error.code
        : error.status === 401 ? "SALESFORCE_TOKEN_EXPIRED" : code;
      if (typeof error.status === "number" && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599) {
        salesforceStatus = error.status;
      }
    }

    return NextResponse.json({ error: code, salesforceStatus }, { status: 502, headers });
  }

  const now = new Date();
  const response: ContractsApiResponse = {
    instanceUrl: getInstanceUrl(),
    dataSource,
    contracts: contracts.map((contract) => ({
      ...contract,
      ...calculateContractDerivedFields(contract.contractEndDate, now),
    })),
  };

  return NextResponse.json(response, { headers });
}