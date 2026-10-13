import { NextResponse } from "next/server";
import { mockContracts } from "@/data/mockContracts";
import { calculateContractDerivedFields } from "@/lib/contract-renewal";
import type { ContractsApiResponse } from "@/types/workspace-contract";

export const dynamic = "force-dynamic";

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

export function GET() {
  const now = new Date();
  const response: ContractsApiResponse = {
    instanceUrl: getInstanceUrl(),
    contracts: mockContracts.map((contract) => ({
      ...contract,
      ...calculateContractDerivedFields(contract.contractEndDate, now),
    })),
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}