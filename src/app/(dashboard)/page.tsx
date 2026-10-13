import Link from "next/link";
import { ArrowUpRight, FolderKanban, CircleCheck, Users } from "lucide-react";
import { ActivityList } from "@/features/dashboard/components/activity-list";
import { ProjectTable } from "@/features/dashboard/components/project-table";
import { activities, projects } from "@/features/dashboard/data";

export default function OverviewPage() {
  const activeProjects = projects.filter((project) => project.status === "Active");
  const completedProjects = projects.filter((project) => project.status === "Complete");
  const owners = new Set(projects.map((project) => project.owner));

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Overview</h1>
          <p className="muted">A clear view of what&apos;s moving across your team.</p>
        </div>
        <span className="demo-label">Sample data</span>
      </header>
      <section className="metrics" aria-label="Workspace metrics">
        <div className="metric">
          <FolderKanban size={20} aria-hidden="true" />
          <span className="muted">Active projects</span>
          <strong>{activeProjects.length.toString().padStart(2, "0")}</strong>
          <span className="metric-note">Across {projects.length} total projects</span>
        </div>
        <div className="metric">
          <CircleCheck size={20} aria-hidden="true" />
          <span className="muted">Completed projects</span>
          <strong>{completedProjects.length.toString().padStart(2, "0")}</strong>
          <span className="metric-note">Ready for the next chapter</span>
        </div>
        <div className="metric">
          <Users size={20} aria-hidden="true" />
          <span className="muted">Project owners</span>
          <strong>{owners.size.toString().padStart(2, "0")}</strong>
          <span className="metric-note">Keeping the work on track</span>
        </div>
      </section>
      <section className="content-section" aria-labelledby="projects-heading">
        <div className="section-heading">
          <h2 id="projects-heading">Projects at a glance</h2>
          <Link className="text-link" href="/projects">View projects <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <ProjectTable projects={projects} />
      </section>
      <section className="content-section" aria-labelledby="activity-heading">
        <div className="section-heading">
          <h2 id="activity-heading">Recent activity</h2>
          <Link className="text-link" href="/activity">View activity <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <ActivityList activities={activities.slice(0, 3)} />
      </section>
    </>
  );
}