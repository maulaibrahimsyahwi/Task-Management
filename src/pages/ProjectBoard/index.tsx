import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useBoards } from "../../context/useBoards";
import { useProjects } from "../../context/useProjects";
import type { Project } from "../../types/collaboration";
import Boards from "../Boards";
import { createBoard, getBoardByProjectId } from "../../services/boardService";
import { ensureBoardMember } from "../../services/collaborationService";
import {
  getProjectById,
  setProjectDefaultBoard,
} from "../../services/projectService";
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
  const { boards, setActiveBoardId, loading: boardsLoading } = useBoards();

  const [projectFromDb, setProjectFromDb] = useState<Project | null>(null);
  const [projectFetching, setProjectFetching] = useState(false);
  const [resolvedBoardId, setResolvedBoardId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectFromList = useMemo(() => {
    if (!projectId) return null;
    return projects.find((p) => p.id === projectId) || null;
  }, [projectId, projects]);

  const project = projectFromList ?? projectFromDb;

  useEffect(() => {
    if (projectId) {
      setActiveProjectId(projectId);
    }
  }, [projectId, setActiveProjectId]);

  useEffect(() => {
    if (projectsLoading) return;
    if (!user || !projectId) return;
    if (projectFromList) {
      setProjectFromDb(null);
      setProjectFetching(false);
      return;
    }

    let cancelled = false;
    setProjectFetching(true);
    getProjectById(projectId)
      .then((fetched) => {
        if (cancelled) return;
        setProjectFromDb(fetched);
      })
      .catch((e) => {
        if (!cancelled) setError(describeOpenProjectError(e));
      })
      .finally(() => {
        if (!cancelled) setProjectFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectFromList, projectId, projectsLoading, user]);

  useEffect(() => {
    if (projectsLoading || boardsLoading) return;

    if (!user || !projectId) {
      setBusy(false);
      return;
    }

    if (projectFetching) return;

    if (!project) {
      setBusy(false);
      return;
    }

    let cancelled = false;

    const prepareBoard = async () => {
      try {
        setBusy(true);
        setError(null);

        let targetBoardId = project.defaultBoardId;

        if (!targetBoardId) {
          const existingBoard = boards.find((b) => b.projectId === project.id);
          if (existingBoard) {
            targetBoardId = existingBoard.id;
            if (project.createdBy === user.uid) {
              await setProjectDefaultBoard(project.id, targetBoardId);
            }
          } else {
            const fetched = await getBoardByProjectId(project.id);
            if (fetched) {
              targetBoardId = fetched.id;
              if (project.createdBy === user.uid) {
                await setProjectDefaultBoard(project.id, targetBoardId);
              }
            }
          }
        }

        if (!targetBoardId) {
          if (project.createdBy === user.uid) {
            const newBoard = await createBoard({
              name: project.name,
              description: project.description,
              createdBy: user.uid,
              projectId: project.id,
            });
            targetBoardId = newBoard.id;

            await ensureBoardMember(newBoard.id, user, "owner");
            await createDefaultColumns(newBoard.id);

            await setProjectDefaultBoard(project.id, newBoard.id);
          } else {
            throw new Error(
              "No board exists for this project and you are not the owner to create one."
            );
          }
        }

        if (cancelled) return;

        if (!targetBoardId) {
          throw new Error("Failed to resolve board ID.");
        }

        if (project.createdBy === user.uid) {
          await ensureBoardMember(targetBoardId, user, "owner");
        }

        setResolvedBoardId(targetBoardId);
        setActiveBoardId(targetBoardId);
      } catch (e) {
        if (!cancelled) setError(describeOpenProjectError(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    prepareBoard();

    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    project,
    user,
    projectsLoading,
    boardsLoading,
    projectFetching,
    boards,
    setActiveBoardId,
  ]);

  if (
    projectsLoading ||
    projectFetching ||
    (boardsLoading && !resolvedBoardId) ||
    busy
  ) {
    return (
      <div className="w-full h-[calc(100vh-64px)] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-4"></div>
        <span className="text-lg font-semibold text-gray-500">
          Opening project workspace...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-8 flex justify-center">
        <div className="max-w-md w-full bg-white rounded-lg p-6 shadow-sm border border-red-100">
          <div className="text-red-600 font-bold text-lg mb-2">
            Failed to open project
          </div>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/projects"
            className="block w-full text-center py-2 rounded-md bg-gray-100 text-gray-700 font-medium hover:bg-gray-200"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="w-full p-8 flex justify-center">
        <div className="max-w-md w-full bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="text-gray-800 font-bold text-lg mb-2">
            Project not found
          </div>
          <p className="text-gray-600 mb-6">
            The project you are looking for does not exist or you do not have
            permission to view it.
          </p>
          <Link
            to="/projects"
            className="block w-full text-center py-2 rounded-md bg-orange-500 text-white font-medium hover:bg-orange-600"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  if (resolvedBoardId) {
    return <Boards boardId={resolvedBoardId} />;
  }

  return <Navigate to="/projects" replace />;
};

export default ProjectBoard;
