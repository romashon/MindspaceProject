import { formatDate } from "@/lib/format";
import type { WorkspaceActivity } from "../types";

export function ActivityList({ activities }: { activities: WorkspaceActivity[] }) {
  return (
    <ul className="activity-list" aria-label="Workspace activity">
      {activities.map((activity) => (
        <li key={activity.id}>
          <span className="avatar" aria-hidden="true">{activity.actor.split(" ").map((part) => part[0]).join("")}</span>
          <p><strong>{activity.actor}</strong> {activity.action} <strong>{activity.project}</strong></p>
          <time dateTime={activity.occurredAt}>{formatDate(activity.occurredAt)}</time>
        </li>
      ))}
    </ul>
  );
}