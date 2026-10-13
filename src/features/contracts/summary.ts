import type { WorkspaceContractWithDerivedFields } from "@/types/workspace-contract";

export function getContractsSummary(contracts: WorkspaceContractWithDerivedFields[]) {
  let expiringSoon = 0;
  let monthlyRevenueAtRisk = 0;

  for (const contract of contracts) {
    if (contract.daysRemaining >= 0 && contract.daysRemaining <= 30) {
      expiringSoon += 1;
    }

    if (contract.riskLevel === "Critical" || contract.riskLevel === "Warning") {
      monthlyRevenueAtRisk += contract.monthlyRevenue;
    }
  }

  return {
    totalContracts: contracts.length,
    expiringSoon,
    monthlyRevenueAtRisk,
  };
}