import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./useAuth";
import { createBoard } from "../services/boardService";
import { ensureBoardMember } from "../services/collaborationService";
import { createDefaultColumns } from "../services/taskService";
import {
  createProject as createProjectDoc,
  deleteProject as deleteProjectDoc,
  setProjectDefaultBoard,
  subscribeProjectsByOwner,
  updateProject as updateProjectDoc,
} from "../services/projectService";
import {
  ProjectContext,
  type ProjectContextValue,
} from "./projectContextStore";
import type { Project } from "../types/collaboration";

const ACTIVE_PROJECT_STORAGE_KEY = "rtm_active_project_v1";

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setActiveProjectIdState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeProjectsByOwner(
      user.uid,
      (next) => {
        setProjects(next);
        setLoading(false);
      },
      () => {
        setProjects([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!projects.length) return;
    const preferredId = profile?.defaultProjectId;
    const hasPreferred =
      preferredId && projects.some((p) => p.id === preferredId);
    if (hasPreferred && (!activeProjectId || !projects.some((p) => p.id === activeProjectId))) {
      setActiveProjectIdState(preferredId);
      return;
    }
    if (!activeProjectId || !projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectIdState(projects[0].id);
    }
  }, [activeProjectId, profile?.defaultProjectId, projects]);

  useEffect(() => {
    if (!user || loading) return;
    if (projects.length === 0) {
      setActiveProjectIdState(null);
      try {
        localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }
    if (activeProjectId && !projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectIdState(projects[0].id);
    }
  }, [activeProjectId, loading, projects, user]);

  const setActiveProjectId = useCallback((projectId: string) => {
    setActiveProjectIdState(projectId);
    try {
      localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectId);
    } catch {
      // ignore
    }
  }, []);

  const createProject = useCallback(
    async (params: { name: string; description?: string }) => {
      if (!user) return null;
      const project = await createProjectDoc({
        name: params.name,
        description: params.description,
        createdBy: user.uid,
      });
      const board = await createBoard({
        name: project.name,
        description: project.description,
        createdBy: user.uid,
        projectId: project.id,
      });
      await ensureBoardMember(board.id, user, "owner");
      await createDefaultColumns(board.id);
      await setProjectDefaultBoard(project.id, board.id);
      setActiveProjectId(project.id);
      return { projectId: project.id, boardId: board.id };
    },
    [setActiveProjectId, user]
  );

  const updateProject = useCallback(
    async (projectId: string, updates: { name?: string; description?: string }) => {
      await updateProjectDoc(projectId, updates);
    },
    []
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      await deleteProjectDoc(projectId);
      if (activeProjectId === projectId) {
        setActiveProjectIdState(null);
      }
    },
    [activeProjectId]
  );

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [activeProjectId, projects]
  );

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      activeProjectId,
      activeProject,
      setActiveProjectId,
      createProject,
      updateProject,
      deleteProject,
      loading,
    }),
    [
      activeProject,
      activeProjectId,
      createProject,
      deleteProject,
      loading,
      projects,
      setActiveProjectId,
      updateProject,
    ]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};
