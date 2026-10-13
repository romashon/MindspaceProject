"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, Clock, MapPin, Search, X } from "lucide-react";
import { formatDate, formatRevenue } from "@/lib/format";
import type { RiskLevel, WorkspaceContractWithDerivedFields } from "@/types/workspace-contract";

const riskStyles: Record<RiskLevel, { classes: string; icon: typeof CircleCheck }> = {
  Critical: { classes: "bg-red-50 text-red-700 ring-red-200/70", icon: CircleAlert },
  Warning: { classes: "bg-orange-50 text-orange-700 ring-orange-200/70", icon: Clock },
  Healthy: { classes: "bg-emerald-50 text-emerald-700 ring-emerald-200/70", icon: CircleCheck },
};

const selectClassName = "h-10 min-w-0 flex-1 rounded-md border border-line bg-white py-2 pl-3 pr-7 text-xs text-ink outline-none transition-colors hover:border-gray-300 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/15 sm:flex-none";

export function ContractsTable({ contracts }: { contracts: WorkspaceContractWithDerivedFields[] }) {
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("All risks");
  const [location, setLocation] = useState("All locations");
  const locations = [...new Set(contracts.map((contract) => contract.location))].sort();
  const normalizedQuery = query.trim().toLowerCase();
  const filteredContracts = contracts.filter((contract) =>
    (risk === "All risks" || contract.riskLevel === risk) &&
    (location === "All locations" || contract.location === location) &&
    `${contract.accountName} ${contract.location} ${contract.id}`.toLowerCase().includes(normalizedQuery),
  ).sort((first, second) => first.contractEndDate.localeCompare(second.contractEndDate));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex h-10 min-w-0 basis-full items-center gap-2.5 rounded-md border border-line bg-white px-3 text-muted transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 sm:max-w-sm sm:flex-1 sm:basis-auto">
          <Search size={16} aria-hidden="true" />
          <input className="h-full w-full min-w-0 flex-1 border-0 bg-transparent text-xs text-ink outline-none placeholder:text-muted/80 focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden" type="search" aria-label="Search contracts" placeholder="Search accounts or locations" value={query} onChange={(event) => setQuery(event.target.value)} />
          {query && <button className="grid size-6 shrink-0 place-items-center rounded text-muted hover:bg-gray-100 hover:text-ink" type="button" onClick={() => setQuery("")} aria-label="Clear search" title="Clear search"><X size={14} aria-hidden="true" /></button>}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <select className={selectClassName} aria-label="Filter by location" value={location} onChange={(event) => setLocation(event.target.value)}>
            <option>All locations</option>
            {locations.map((city) => <option key={city}>{city}</option>)}
          </select>
          <select className={selectClassName} aria-label="Filter by risk" value={risk} onChange={(event) => setRisk(event.target.value)}>
            <option>All risks</option>
            <option>Critical</option>
            <option>Warning</option>
            <option>Healthy</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto border-y border-line bg-white" role="region" aria-label="Contracts table" tabIndex={0}>
        <table className="contracts-table w-full min-w-[1000px] border-collapse whitespace-nowrap text-left text-xs text-ink [&_td]:border-b [&_td]:border-line/70 [&_td]:px-4 [&_td]:py-4 [&_th]:px-4">
          <caption className="sr-only">Workspace contracts, locations, desks, monthly revenue, expiration dates, days remaining, and risk levels</caption>
          <thead className="border-b border-line bg-gray-50/80 text-[11px] font-medium text-muted [&_th]:py-3 [&_th]:font-medium">
            <tr><th scope="col">Account</th><th scope="col">Location</th><th scope="col" className="text-right">Desks</th><th scope="col" className="text-right">Monthly revenue</th><th scope="col">Contract end</th><th scope="col" className="text-right">Days remaining</th><th scope="col">Risk</th></tr>
          </thead>
          <tbody className="[&_tr:last-child_td]:border-b-0 [&_tr:last-child_th]:border-b-0">
            {filteredContracts.map((contract) => {
              const { classes, icon: RiskIcon } = riskStyles[contract.riskLevel];

              return (
                <tr key={contract.id} className="transition-colors hover:bg-brand-soft/40">
                  <th scope="row" className="min-w-[260px] border-b border-line/70 py-4 font-medium"><span className="block text-[13px] font-semibold">{contract.accountName}</span><span className="mt-1 block text-[10px] font-normal text-muted">{contract.id}</span></th>
                  <td><span className="flex items-center gap-1.5 text-muted"><MapPin size={12} aria-hidden="true" />{contract.location}</span></td>
                  <td className="text-right tabular-nums">{contract.deskCount.toLocaleString("en-US")}</td>
                  <td className="text-right font-medium tabular-nums">{formatRevenue(contract.monthlyRevenue)}</td>
                  <td className="text-muted"><time dateTime={contract.contractEndDate}>{formatDate(contract.contractEndDate)}</time></td>
                  <td className={`text-right font-medium tabular-nums ${contract.daysRemaining < 30 ? "text-red-700" : "text-muted"}`}>{contract.daysRemaining < 0 ? `${Math.abs(contract.daysRemaining)} overdue` : contract.daysRemaining === 0 ? "Today" : contract.daysRemaining}</td>
                  <td><span className={`risk-${contract.riskLevel.toLowerCase()} inline-flex min-w-[86px] items-center justify-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${classes}`}><RiskIcon size={12} aria-hidden="true" />{contract.riskLevel}</span></td>
                </tr>
              );
            })}
            {filteredContracts.length === 0 && <tr><td colSpan={7}><p className="py-12 text-center text-sm text-muted">{contracts.length === 0 ? "No contracts available." : "No contracts match the selected filters."}</p></td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-muted" role="status">{filteredContracts.length} of {contracts.length} contracts</p>
    </div>
  );
}