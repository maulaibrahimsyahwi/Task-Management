import { useEffect, useMemo } from "react";
import { Navigate, useLocation, useParams } from "react-router";
import { Link } from "react-router-dom";
import { useBoards } from "../../context/useBoards";
import { useProjects } from "../../context/useProjects";
import Boards from "../Boards";

const ProjectBoard = () => {
  const { projectId } = useParams();
  const { state } = useLocation();
  const {
    projects,
    loading: projectsLoading,
    setActiveProjectId,
  } = useProjects();
  const { boards, setActiveBoardId } = useBoards();

  const project = useMemo(() => {
    if (!projectId) return null;
    return projects.find((p) => p.id === projectId) || null;
  }, [projectId, projects]);

  const targetBoardId = useMemo(() => {
    if (state?.initialBoardId) return state.initialBoardId;
    if (!project) return null;
    if (project.defaultBoardId) return project.defaultBoardId;
    const found = boards.find((b) => b.projectId === project.id);
    return found ? found.id : null;
  }, [boards, project, state]);

  useEffect(() => {
    if (projectId) {
      setActiveProjectId(projectId);
    }
  }, [projectId, setActiveProjectId]);

  useEffect(() => {
    if (targetBoardId) {
      setActiveBoardId(targetBoardId);
    }
  }, [targetBoardId, setActiveBoardId]);

  if (projectsLoading) {
    return (
      <div className="w-full flex items-center justify-center py-10">
        <span className="text-lg font-semibold text-gray-100">
          Loading project...
        </span>
      </div>
    );
  }

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  if (targetBoardId) {
    return <Boards />;
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

  return (
    <div className="w-full bg-white rounded-lg p-5 shadow-sm">
      <div className="text-lg font-bold text-gray-800">No Board Found</div>
      <div className="text-sm text-gray-600 mt-1">
        This project exists but has no linked board available to you.
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
};

export default ProjectBoard;
