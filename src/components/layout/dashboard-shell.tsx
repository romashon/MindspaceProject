import Link from "next/link";
import { ChevronRight, Layers, LockKeyhole } from "lucide-react";
import { DashboardNav } from "@/components/layout/dashboard-nav";

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] bg-canvas lg:grid-cols-[232px_minmax(0,1fr)]">
      <a className="fixed left-4 top-4 z-50 -translate-y-24 rounded-md bg-ink px-4 py-2 text-white focus:translate-y-0" href="#main-content">Skip to content</a>
      <aside className="flex flex-col gap-5 border-b border-line bg-white px-5 py-5 lg:sticky lg:top-0 lg:h-dvh lg:gap-10 lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
        <Link href="/" className="flex items-center gap-3 lg:px-3" aria-label="Mindspace home">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-white"><Layers size={21} aria-hidden="true" /></span>
          <span className="text-xl font-bold leading-tight text-ink">Mindspace<span className="mt-1 block text-[10px] font-medium text-muted">TEAM WORKSPACE</span></span>
        </Link>
        <div className="min-w-0">
          <p className="mb-3 hidden px-3 text-[10px] font-semibold uppercase text-muted lg:block">Workspace</p>
          <DashboardNav />
        </div>
        <div className="mt-auto hidden items-center gap-2 border-t border-line px-3 pt-5 text-xs text-muted lg:flex">
          <LockKeyhole size={14} aria-hidden="true" />Internal workspace
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-line bg-white px-5 py-4 md:px-8 xl:px-10">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
            <span className="shrink-0">Mindspace</span><ChevronRight size={13} aria-hidden="true" /><span className="truncate font-medium text-ink">Team workspace</span>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted"><LockKeyhole size={12} aria-hidden="true" />Internal</span>
        </header>
        <main id="main-content" className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 p-5 py-7 md:p-8 xl:p-10" tabIndex={-1}>{children}</main>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-5 text-[11px] text-muted md:px-8 xl:px-10"><span className="font-semibold">Mindspace</span><span>Workspace operations</span></footer>
      </div>
    </div>
  );
}