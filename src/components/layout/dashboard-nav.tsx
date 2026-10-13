"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FolderKanban, LayoutDashboard } from "lucide-react";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/activity", label: "Activity", icon: Activity },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-3 gap-1 lg:grid-cols-1 lg:gap-1.5" aria-label="Main navigation">
      {navigation.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-2 py-2.5 text-xs font-medium transition-colors lg:justify-start lg:gap-3 lg:px-3 lg:text-sm ${pathname === href ? "bg-brand-soft text-brand ring-1 ring-inset ring-brand/10" : "text-muted hover:bg-gray-50 hover:text-ink"}`}>
          <Icon size={18} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}