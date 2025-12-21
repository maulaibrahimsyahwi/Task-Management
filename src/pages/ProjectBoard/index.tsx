import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useBoards } from "../../context/useBoards";
import { useProjects } from "../../context/useProjects";
import Boards from "../Boards";
import { createBoard, getBoardByProjectId } from "../../services/boardService";
import { ensureBoardMember } from "../../services/collaborationService";
import { setProjectDefaultBoard } from "../../services/projectService";
import { createDefaultColumns } from "../../services/taskService";

const describeOpenProjectError = (e: unknown) => {
  if (e && typeof e === "object") {
    const code = "code" in e ? String((e as { code?: unknown }).code) : "";
    const message =
      "message" in e ? String((e as { message?: unknown }).message) : "";
    if (code === "permission-denied") {
      return "Permission denied. Make sure `firestore.rules` has been deployed to your Firebase project.";
    }
    return message || "Something went wrong while opening this project.";
  }
  return "Something went wrong while opening this project.";
};

const ProjectBoard = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const {
    projects,
    loading: projectsLoading,
    setActiveProjectId,
  } = useProjects();
  const { boards, setActiveBoardId, activeBoardId, loading: boardsLoading } =
    useBoards();
  const [resolvedBoardId, setResolvedBoardId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const project = useMemo(() => {
    if (!projectId) return null;
    return projects.find((p) => p.id === projectId) || null;
  }, [projectId, projects]);

  const knownBoardId = useMemo(() => {
    if (!project) return null;
    if (typeof project.defaultBoardId === "string" && project.defaultBoardId) {
      return project.defaultBoardId;
    }
    const found = boards.find((b) => b.projectId === project.id);
    return found?.id ?? null;
  }, [boards, project]);

  useEffect(() => {
    if (projectId) {
      setActiveProjectId(projectId);
    }
  }, [projectId, setActiveProjectId]);

  useEffect(() => {
    if (!projectId) return;
    if (!user) return;
    if (projectsLoading || boardsLoading) return;
    if (!project) return;
    if (busy || error) return;

    if (knownBoardId) {
      setResolvedBoardId(knownBoardId);
      setActiveBoardId(knownBoardId);
      void ensureBoardMember(knownBoardId, user, "owner").catch(() => {
        // ignore
      });
      if (!project.defaultBoardId) {
        void setProjectDefaultBoard(project.id, knownBoardId).catch(() => {
          // ignore
        });
      }
      return;
    }

    let cancelled = false;
    const run = async () => {
      setBusy(true);
      setError(null);
      try {
        const existing = await getBoardByProjectId(project.id);
        if (cancelled) return;
        if (existing) {
          setResolvedBoardId(existing.id);
          setActiveBoardId(existing.id);
          try {
            await ensureBoardMember(existing.id, user, "owner");
          } catch {
            // ignore
          }
          try {
            await setProjectDefaultBoard(project.id, existing.id);
          } catch {
            // ignore
          }
          return;
        }

        if (project.createdBy !== user.uid) {
          setError(
            "This project exists but has no linked board available to you."
          );
          return;
        }

        const created = await createBoard({
          name: project.name,
          description: project.description,
          createdBy: user.uid,
          projectId: project.id,
        });
        if (cancelled) return;
        setResolvedBoardId(created.id);
        setActiveBoardId(created.id);
        try {
          await ensureBoardMember(created.id, user, "owner");
        } catch {
          // ignore
        }
        try {
          await createDefaultColumns(created.id);
        } catch {
          // ignore
        }
        try {
          await setProjectDefaultBoard(project.id, created.id);
        } catch {
          // ignore
        }
      } catch (e) {
        if (!cancelled) setError(describeOpenProjectError(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    boardsLoading,
    busy,
    error,
    knownBoardId,
    project,
    projectId,
    projectsLoading,
    setActiveBoardId,
    user,
  ]);

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  if (projectsLoading || boardsLoading || busy) {
    return (
      <div className="w-full flex items-center justify-center py-10">
        <span className="text-lg font-semibold text-gray-100">
          Opening project...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-white rounded-lg p-5 shadow-sm">
        <div className="text-red-600 font-semibold">Failed to open project</div>
        <div className="text-sm text-gray-600 mt-1">{error}</div>
        <div className="mt-4">
          <Link
            to="/projects"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-400 text-white font-medium hover:bg-orange-500"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="w-full bg-white rounded-lg p-5 shadow-sm">
        <div className="text-red-600 font-semibold">Project not found</div>
        <div className="text-sm text-gray-600 mt-1">
          Make sure you have access to this project.
        </div>
        <div className="mt-4">
          <Link
            to="/projects"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-400 text-white font-medium hover:bg-orange-500"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  if (resolvedBoardId) {
    if (activeBoardId !== resolvedBoardId) {
      return (
        <div className="w-full flex items-center justify-center py-10">
          <span className="text-lg font-semibold text-gray-100">
            Opening board...
          </span>
        </div>
      );
    }
    return <Boards />;
  }

  return <Navigate to="/projects" replace />;
};

export default ProjectBoard;
