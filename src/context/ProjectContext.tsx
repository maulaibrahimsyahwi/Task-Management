import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./useAuth";
import { subscribeBoardMemberships } from "../services/collaborationService";
import { subscribeBoardsByIds } from "../services/boardService";
import {
  createProject as createProjectDoc,
  deleteProject as deleteProjectDoc,
  subscribeProjectsByIds,
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
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(
    () => {
      try {
        return localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
      } catch {
        return null;
      }
    }
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setActiveProjectIdState(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    let unsubscribeMemberships = () => {};
    let unsubscribeBoards = () => {};
    let unsubscribeProjects = () => {};
    let lastProjectIdsKey = "";

    unsubscribeMemberships = subscribeBoardMemberships(
      user.uid,
      (memberships) => {
        const boardIds = memberships
          .map((m) => m.boardId)
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0);

        unsubscribeBoards();
        unsubscribeProjects();

        if (boardIds.length === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }

        unsubscribeBoards = subscribeBoardsByIds(boardIds, (boards) => {
          const projectIds = Array.from(
            new Set(
              boards
                .map((b) => b.projectId)
                .filter(
                  (id): id is string =>
                    typeof id === "string" && id.trim().length > 0
                )
            )
          );

          // avoid resubscribing when ids are the same set
          const key = projectIds.slice().sort().join("|");
          if (key === lastProjectIdsKey) return;
          lastProjectIdsKey = key;

          unsubscribeProjects();
          if (projectIds.length === 0) {
            setProjects([]);
            setLoading(false);
            return;
          }

          setLoading(true);
          unsubscribeProjects = subscribeProjectsByIds(
            projectIds,
            (next) => {
              setProjects(next);
              setLoading(false);
            },
            () => {
              setProjects([]);
              setLoading(false);
            }
          );
        });
      }
    );

    return () => {
      unsubscribeProjects();
      unsubscribeBoards();
      unsubscribeMemberships();
    };
  }, [user]);

  useEffect(() => {
    if (!projects.length) return;
    const preferredId = profile?.defaultProjectId;
    const hasPreferred =
      preferredId && projects.some((p) => p.id === preferredId);
    if (
      hasPreferred &&
      (!activeProjectId || !projects.some((p) => p.id === activeProjectId))
    ) {
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

      // Service handles creation of Project, Board, Columns, and Members
      const newProject = await createProjectDoc({
        name: params.name,
        description: params.description,
        createdBy: user.uid,
      });

      setActiveProjectId(newProject.id);

      return {
        projectId: newProject.id,
        boardId: newProject.boardId, // Ensure createProjectDoc returns this (it does in updated service)
      };
    },
    [setActiveProjectId, user]
  );

  const updateProject = useCallback(
    async (
      projectId: string,
      updates: { name?: string; description?: string }
    ) => {
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

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
};
