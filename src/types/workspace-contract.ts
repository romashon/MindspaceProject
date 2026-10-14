export type RiskLevel = "Critical" | "Warning" | "Healthy";

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

export interface ContractsApiResponse {
  instanceUrl: string | null;
  dataSource: "mock" | "salesforce";
  contracts: WorkspaceContractWithDerivedFields[];
}