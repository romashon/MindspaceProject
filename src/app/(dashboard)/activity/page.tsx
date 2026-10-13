import type { Metadata } from "next";
import { ActivityList } from "@/features/dashboard/components/activity-list";
import { activities } from "@/features/dashboard/data";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Activity</h1>
          <p className="muted">The latest updates from across the workspace.</p>
        </div>
        <span className="demo-label">Sample data</span>
      </header>
      <ActivityList activities={activities} />
    </>
  );
}