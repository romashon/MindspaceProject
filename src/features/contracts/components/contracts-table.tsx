"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { formatDate, formatRevenue } from "@/lib/format";
import type { WorkspaceContractWithDerivedFields } from "@/types/workspace-contract";

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
    <div className="contracts-list">
      <div className="table-toolbar contracts-toolbar">
        <div className="search-field">
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Search contracts" placeholder="Search accounts or locations" value={query} onChange={(event) => setQuery(event.target.value)} />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" title="Clear search"><X size={16} aria-hidden="true" /></button>}
        </div>
        <div className="contracts-filters">
          <select aria-label="Filter by location" value={location} onChange={(event) => setLocation(event.target.value)}>
            <option>All locations</option>
            {locations.map((city) => <option key={city}>{city}</option>)}
          </select>
          <select aria-label="Filter by risk" value={risk} onChange={(event) => setRisk(event.target.value)}>
            <option>All risks</option>
            <option>Critical</option>
            <option>Warning</option>
            <option>Healthy</option>
          </select>
        </div>
      </div>
      <div className="table-scroll" role="region" aria-label="Contracts table" tabIndex={0}>
        <table className="contracts-table">
          <caption className="sr-only">Workspace contracts, locations, desks, monthly revenue, expiration dates, days remaining, and risk levels</caption>
          <thead>
            <tr><th scope="col">Account</th><th scope="col">Location</th><th scope="col" className="numeric">Desks</th><th scope="col" className="numeric">Monthly revenue</th><th scope="col">Contract end</th><th scope="col" className="numeric">Days remaining</th><th scope="col">Risk</th></tr>
          </thead>
          <tbody>
            {filteredContracts.map((contract) => (
              <tr key={contract.id}>
                <th scope="row"><span className="contract-account">{contract.accountName}</span><span className="contract-id">{contract.id}</span></th>
                <td>{contract.location}</td>
                <td className="numeric">{contract.deskCount.toLocaleString("en-US")}</td>
                <td className="numeric">{formatRevenue(contract.monthlyRevenue)}</td>
                <td><time dateTime={contract.contractEndDate}>{formatDate(contract.contractEndDate)}</time></td>
                <td className={`numeric ${contract.daysRemaining < 0 ? "overdue" : ""}`}>{contract.daysRemaining < 0 ? `${Math.abs(contract.daysRemaining)} overdue` : contract.daysRemaining === 0 ? "Today" : contract.daysRemaining}</td>
                <td><span className={`status risk-${contract.riskLevel.toLowerCase()}`}>{contract.riskLevel}</span></td>
              </tr>
            ))}
            {filteredContracts.length === 0 && <tr><td colSpan={7} className="empty-state">{contracts.length === 0 ? "No contracts available." : "No contracts match the selected filters."}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="table-count" role="status">{filteredContracts.length} of {contracts.length} contracts</p>
    </div>
  );
}