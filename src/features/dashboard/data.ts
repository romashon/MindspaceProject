import type { Project, WorkspaceActivity } from "./types";

export const projects: Project[] = [
  { id: "ops", name: "Operations hub", description: "A shared home for daily operations", owner: "Alex Morgan", status: "Active", progress: 72, updatedAt: "2026-10-13T09:30:00Z" },
  { id: "onboarding", name: "Team onboarding", description: "A smoother start for every new teammate", owner: "Sam Rivera", status: "Active", progress: 48, updatedAt: "2026-10-12T14:00:00Z" },
  { id: "reporting", name: "Quarterly reporting", description: "Bringing the numbers into focus", owner: "Jamie Chen", status: "Planning", progress: 15, updatedAt: "2026-10-11T11:15:00Z" },
  { id: "knowledge", name: "Knowledge library", description: "The right information, in one place", owner: "Alex Morgan", status: "Active", progress: 86, updatedAt: "2026-10-10T16:00:00Z" },
  { id: "directory", name: "Team directory", description: "Connecting people across the workspace", owner: "Taylor Kim", status: "Complete", progress: 100, updatedAt: "2026-10-09T10:00:00Z" },
];

export const activities: WorkspaceActivity[] = [
  { id: "activity-1", actor: "Alex Morgan", action: "updated the milestones for", project: "Operations hub", occurredAt: "2026-10-13T09:30:00Z" },
  { id: "activity-2", actor: "Sam Rivera", action: "completed a review for", project: "Team onboarding", occurredAt: "2026-10-12T14:00:00Z" },
  { id: "activity-3", actor: "Jamie Chen", action: "started planning", project: "Quarterly reporting", occurredAt: "2026-10-11T11:15:00Z" },
  { id: "activity-4", actor: "Alex Morgan", action: "published an update to", project: "Knowledge library", occurredAt: "2026-10-10T16:00:00Z" },
  { id: "activity-5", actor: "Taylor Kim", action: "completed", project: "Team directory", occurredAt: "2026-10-09T10:00:00Z" },
];