export const projectStatuses = ["Active", "Planning", "Complete"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export type Project = {
  id: string;
  name: string;
  description: string;
  owner: string;
  status: ProjectStatus;
  progress: number;
  updatedAt: string;
};

export type WorkspaceActivity = {
  id: string;
  actor: string;
  action: string;
  project: string;
  occurredAt: string;
};