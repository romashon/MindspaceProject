import type { Metadata } from "next";
import { ProjectTable } from "@/features/dashboard/components/project-table";
import { projects } from "@/features/dashboard/data";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Projects</h1>
          <p className="muted">The work in progress, and the work already delivered.</p>
        </div>
        <span className="demo-label">Sample data</span>
      </header>
      <ProjectTable projects={projects} />
    </>
  );
}