export type RiskLevel = "low" | "medium" | "high";

export interface WorkspaceContract {
  id: string;
  accountName: string;
  location: string;
  deskCount: number;
  monthlyRevenue: number;
  contractEndDate: string;
}

export interface WorkspaceContractDerivedFields {
  daysRemaining: number;
  riskLevel: RiskLevel;
}

export interface WorkspaceContractWithDerivedFields
  extends WorkspaceContract, WorkspaceContractDerivedFields {}