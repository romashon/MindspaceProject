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
    { label: "Total contracts", value: summary?.totalContracts.toLocaleString("en-US"), detail: "Portfolio total", icon: FileText, iconStyle: "bg-brand-soft text-brand", accentStyle: "bg-brand" },
    { label: "Expiring within 30 days", value: summary?.expiringSoon.toLocaleString("en-US"), detail: "Today through day 30", icon: CalendarClock, iconStyle: "bg-orange-50 text-orange-700", accentStyle: "bg-orange-500" },
    { label: "Monthly revenue at risk", value: summary ? formatRevenue(summary.monthlyRevenueAtRisk) : undefined, detail: "Critical + Warning", icon: CircleDollarSign, iconStyle: "bg-red-50 text-red-700", accentStyle: "bg-red-500" },
  ];

  return (
    <>
      <header className="mb-7 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-[10px] font-semibold uppercase text-brand">Contract portfolio</p>
          <h1 className="mb-0 text-[28px] font-semibold leading-tight text-ink [overflow-wrap:anywhere]">Workspace Renewal Tracker</h1>
        </div>
        <button className="grid size-10 shrink-0 place-items-center rounded-md border border-line bg-white text-muted shadow-sm transition-colors hover:border-brand/30 hover:bg-brand-soft hover:text-brand disabled:cursor-wait disabled:opacity-50" type="button" onClick={reloadContracts} disabled={state.status === "loading"} aria-label="Refresh contracts" title="Refresh contracts">
          <RefreshCw size={17} aria-hidden="true" className={state.status === "loading" ? "motion-safe:animate-spin" : undefined} />
        </button>
      </header>
      <section className="mb-9 grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Contract summary" aria-busy={state.status === "loading"}>
        {cards.map(({ label, value, detail, icon: Icon, iconStyle, accentStyle }) => (
          <article className="summary-card relative flex min-h-[160px] min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-white p-5 shadow-metric" key={label} aria-label={label}>
            <span className={`absolute inset-y-5 left-0 w-0.5 rounded-r ${accentStyle}`} aria-hidden="true" />
            <div className="summary-card-heading mb-3 flex min-h-9 items-start justify-between gap-3"><span className="pt-1 text-xs font-medium leading-5 text-muted">{label}</span><span className={`grid size-8 shrink-0 place-items-center rounded-md ${iconStyle}`}><Icon size={17} aria-hidden="true" /></span></div>
            {value !== undefined ? <strong className="summary-value block text-[30px] font-semibold leading-tight text-ink tabular-nums [overflow-wrap:anywhere]">{value}</strong> : <span className="h-[38px] w-28 max-w-full rounded bg-gray-100 motion-safe:animate-pulse" aria-hidden="true" />}
            <span className="summary-detail mt-2 text-[11px] text-muted">{detail}</span>
          </article>
        ))}
      </section>
      <section aria-labelledby="contracts-heading">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><h2 id="contracts-heading" className="text-base font-semibold text-ink">Contracts</h2>{summary && <span className="grid min-w-6 place-items-center rounded border border-line bg-white px-1.5 py-0.5 text-[10px] font-semibold text-muted">{summary.totalContracts}</span>}</div>
          <span className="flex items-center gap-1.5 text-[11px] text-muted"><span className="size-1.5 rounded-full bg-gray-400" aria-hidden="true" />Sample data</span>
        </div>
        {state.status === "loading" && (
          <div className="min-h-[360px] border-y border-line bg-white" role="status">
            <span className="sr-only">Loading contracts...</span>
            {Array.from({ length: 6 }, (_, index) => <div className="grid min-h-[60px] grid-cols-[2fr_1fr_1fr] items-center gap-6 border-b border-line p-4" key={index} aria-hidden="true">{[0, 1, 2].map((column) => <span key={column} className="h-3 max-w-44 rounded bg-gray-100 motion-safe:animate-pulse" />)}</div>)}
          </div>
        )}
        {state.status === "error" && (
          <div className="flex flex-wrap items-center gap-3 border-y border-red-100 bg-red-50/50 p-5 text-red-800" role="alert">
            <AlertCircle size={19} aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm">Could not load contracts.</p>
            <button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-xs font-medium text-ink hover:bg-gray-50" onClick={reloadContracts}><RefreshCw size={15} aria-hidden="true" />Retry</button>
          </div>
        )}
        {state.status === "success" && <ContractsTable contracts={state.data.contracts} />}
      </section>
    </>
  );
}