import type { WorkspaceRenewal } from "@/types/renewal";

export type RenewalLoader = () => Promise<WorkspaceRenewal[]>;