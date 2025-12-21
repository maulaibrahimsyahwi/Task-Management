import { createContext } from "react";
import type { Project } from "../types/collaboration";

export type ProjectContextValue = {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  setActiveProjectId: (projectId: string) => void;
  createProject: (params: {
    name: string;
    description?: string;
  }) => Promise<{ projectId: string; boardId: string } | null>;
  updateProject: (
    projectId: string,
    updates: { name?: string; description?: string }
  ) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  loading: boolean;
};

export const ProjectContext = createContext<ProjectContextValue | undefined>(
  undefined
);
