import type { Metadata } from "next";
import { ContractsDashboard } from "@/features/contracts/components/contracts-dashboard";

export const metadata: Metadata = { title: "Workspace Renewal Tracker" };

export default function OverviewPage() {
  return <ContractsDashboard />;
}