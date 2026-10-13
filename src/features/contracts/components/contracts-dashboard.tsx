"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CalendarClock, CircleDollarSign, FileText, RefreshCw } from "lucide-react";
import { formatRevenue } from "@/lib/format";
import type { ContractsApiResponse } from "@/types/workspace-contract";
import { getContractsSummary } from "../summary";
import { ContractsTable } from "./contracts-table";

type ContractsState =
  | { status: "loading" }
  | { status: "success"; data: ContractsApiResponse }
  | { status: "error" };

export function ContractsDashboard() {
  const [state, setState] = useState<ContractsState>({ status: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadContracts() {
      try {
        const response = await fetch("/api/contracts", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Contracts request failed.");
        }

        const data: ContractsApiResponse = await response.json();

        if (!data || !Array.isArray(data.contracts)) {
          throw new Error("Invalid contracts response.");
        }

        if (!controller.signal.aborted) {
          setState({ status: "success", data });
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error" });
        }
      }
    }

    void loadContracts();
    return () => controller.abort();
  }, [requestVersion]);

  function reloadContracts() {
    setState({ status: "loading" });
    setRequestVersion((version) => version + 1);
  }

  const summary = state.status === "success" ? getContractsSummary(state.data.contracts) : null;
  const cards = [
    { label: "Total contracts", value: summary?.totalContracts.toLocaleString("en-US"), detail: "Portfolio total", icon: FileText, tone: "neutral" },
    { label: "Expiring within 30 days", value: summary?.expiringSoon.toLocaleString("en-US"), detail: "Today through day 30", icon: CalendarClock, tone: "warning" },
    { label: "Monthly revenue at risk", value: summary ? formatRevenue(summary.monthlyRevenueAtRisk) : undefined, detail: "Critical + Warning", icon: CircleDollarSign, tone: "critical" },
  ];

  return (
    <>
      <header className="page-heading contracts-page-heading">
        <div>
          <p className="eyebrow">CONTRACT PORTFOLIO</p>
          <h1>Workspace Renewal Tracker</h1>
        </div>
        <button className="icon-button" type="button" onClick={reloadContracts} disabled={state.status === "loading"} aria-label="Refresh contracts" title="Refresh contracts">
          <RefreshCw size={18} aria-hidden="true" className={state.status === "loading" ? "refreshing" : undefined} />
        </button>
      </header>
      <section className="contract-summary" aria-label="Contract summary" aria-busy={state.status === "loading"}>
        {cards.map(({ label, value, detail, icon: Icon, tone }) => (
          <article className={`summary-card summary-${tone}`} key={label} aria-label={label}>
            <div className="summary-card-heading"><span>{label}</span><Icon size={19} aria-hidden="true" /></div>
            {value !== undefined ? <strong className="summary-value">{value}</strong> : <span className="summary-placeholder" aria-hidden="true" />}
            <span className="summary-detail">{detail}</span>
          </article>
        ))}
      </section>
      <section className="content-section" aria-labelledby="contracts-heading">
        <div className="section-heading">
          <h2 id="contracts-heading">Contracts</h2>
          <span className="demo-label">Sample data</span>
        </div>
        {state.status === "loading" && (
          <div className="contracts-loading" role="status">
            <span className="sr-only">Loading contracts...</span>
            {Array.from({ length: 6 }, (_, index) => <div className="loading-row" key={index} aria-hidden="true"><span /><span /><span /></div>)}
          </div>
        )}
        {state.status === "error" && (
          <div className="contracts-error" role="alert">
            <AlertCircle size={20} aria-hidden="true" />
            <p>Could not load contracts.</p>
            <button type="button" className="retry-button" onClick={reloadContracts}><RefreshCw size={16} aria-hidden="true" />Retry</button>
          </div>
        )}
        {state.status === "success" && <ContractsTable contracts={state.data.contracts} />}
      </section>
    </>
  );
}