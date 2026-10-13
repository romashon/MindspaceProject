import type { WorkspaceContractDerivedFields } from "@/types/workspace-contract";

export function calculateContractDerivedFields(
  contractEndDate: string,
  now: Date = new Date(),
): WorkspaceContractDerivedFields {
  const endDate = new Date(`${contractEndDate}T00:00:00.000Z`);

  if (Number.isNaN(endDate.getTime()) || Number.isNaN(now.getTime())) {
    throw new Error("Invalid date supplied for contract renewal calculation.");
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysRemaining = Math.round((endDate.getTime() - today) / 86_400_000);
  const riskLevel = daysRemaining < 30
    ? "Critical"
    : daysRemaining <= 90
      ? "Warning"
      : "Healthy";

  return { daysRemaining, riskLevel };
}