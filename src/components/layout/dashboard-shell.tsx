import Link from "next/link";
import { Layers } from "lucide-react";
import { DashboardNav } from "@/components/layout/dashboard-nav";

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Mindspace home">
          <span className="brand-mark"><Layers size={22} aria-hidden="true" /></span>
          <span>Mindspace<span className="brand-caption">TEAM WORKSPACE</span></span>
        </Link>
        <DashboardNav />
        <div className="sidebar-footer">
          <span className="workspace-indicator" aria-hidden="true" />
          Internal workspace
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <span>Mindspace <span className="header-divider">/</span> Team workspace</span>
          <span className="workspace-tag">Internal</span>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>{children}</main>
        <footer className="workspace-footer">Mindspace <span>One workspace. A little more clarity.</span></footer>
      </div>
    </div>
  );
}