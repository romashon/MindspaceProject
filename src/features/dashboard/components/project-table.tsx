"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { projectStatuses, type Project } from "../types";

export function ProjectTable({ projects }: { projects: Project[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProjects = projects.filter((project) =>
    (status === "All statuses" || project.status === status) &&
    `${project.name} ${project.description} ${project.owner}`.toLowerCase().includes(normalizedQuery),
  );

  return (
    <div className="project-list">
      <div className="table-toolbar">
        <div className="search-field">
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Search projects" placeholder="Search projects or people" value={query} onChange={(event) => setQuery(event.target.value)} />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" title="Clear search"><X size={16} aria-hidden="true" /></button>}
        </div>
        <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option>All statuses</option>
          {projectStatuses.map((projectStatus) => <option key={projectStatus}>{projectStatus}</option>)}
        </select>
      </div>
      <div className="table-scroll" role="region" aria-label="Projects table" tabIndex={0}>
        <table>
          <caption className="sr-only">Workspace projects, owners, status, progress, and last update</caption>
          <thead><tr><th scope="col">Project</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Progress</th><th scope="col">Updated</th></tr></thead>
          <tbody>
            {filteredProjects.map((project) => (
              <tr key={project.id}>
                <th scope="row"><span className="project-name">{project.name}</span><span className="project-description">{project.description}</span></th>
                <td>{project.owner}</td>
                <td><span className={`status status-${project.status.toLowerCase()}`}>{project.status}</span></td>
                <td><div className="progress-cell"><progress value={project.progress} max={100} aria-label={`${project.name} progress`} /><span>{project.progress}%</span></div></td>
                <td><time dateTime={project.updatedAt}>{formatDate(project.updatedAt)}</time></td>
              </tr>
            ))}
            {filteredProjects.length === 0 && <tr><td colSpan={5} className="empty-state">No projects match your search.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="table-count" role="status">{filteredProjects.length} of {projects.length} projects</p>
    </div>
  );
}