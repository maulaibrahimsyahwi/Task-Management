import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useBoards } from "../../context/useBoards";
import { useProjects } from "../../context/useProjects";

const describeProjectError = (e: unknown) => {
  if (e && typeof e === "object") {
    const code = "code" in e ? String((e as { code?: unknown }).code) : "";
    const message =
      "message" in e ? String((e as { message?: unknown }).message) : "";
    if (code === "permission-denied") {
      return "Permission denied. Make sure `firestore.rules` has been deployed to your Firebase project.";
    }
    return message || "Failed to create project.";
  }
  return "Failed to create project.";
};

const describeDeleteProjectError = (e: unknown) => {
  if (e && typeof e === "object") {
    const code = "code" in e ? String((e as { code?: unknown }).code) : "";
    const message =
      "message" in e ? String((e as { message?: unknown }).message) : "";
    if (code === "permission-denied") {
      return (
        message ||
        "Permission denied. Make sure `firestore.rules` has been deployed to your Firebase project."
      );
    }
    return message || "Failed to delete project.";
  }
  return "Failed to delete project.";
};


const Projects = () => {
  const { user } = useAuth();
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    createProject,
    deleteProject,
    loading,
  } = useProjects();
  const { setActiveBoardId } = useBoards();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createProject({ name, description });
      setName("");
      setDescription("");
      if (created) {
        setActiveBoardId(created.boardId);
        // FIX: Gunakan created.projectId, bukan created.id
        navigate(`/board/${created.projectId}`, {
          state: { initialBoardId: created.boardId },
        });
      }
    } catch (e) {
      setError(describeProjectError(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (projectId: string, projectName: string) => {
    if (deletingId) return;
    const ok = window.confirm(
      `Delete project "${projectName}"? This will remove its board, columns, and tasks.`
    );
    if (!ok) return;

    setDeleteError(null);
    setDeletingId(projectId);
    try {
      await deleteProject(projectId);
    } catch (e) {
      setDeleteError(describeDeleteProjectError(e));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-10">
        <span className="text-lg font-semibold text-gray-200">
          Loading projects...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-8">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <div className="text-xl font-bold text-gray-800">Projects</div>
        <div className="text-sm text-gray-600">
          Each project has a task board with default columns.
        </div>

        <div className="mt-5 grid md:grid-cols-3 grid-cols-1 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="h-11 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="h-11 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="h-11 rounded-md bg-orange-400 text-white font-semibold hover:bg-orange-500 disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create project"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-gray-700 bg-white rounded-lg border border-gray-100 px-4 py-3 shadow-sm">
          <span className="text-red-600 font-semibold">Error:</span> {error}
        </div>
      ) : null}

      {deleteError ? (
        <div className="text-sm text-gray-700 bg-white rounded-lg border border-gray-100 px-4 py-3 shadow-sm">
          <span className="text-red-600 font-semibold">Error:</span> {deleteError}
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
        {projects.map((project) => {
          const isActive = activeProjectId === project.id;
          const isOwner = !!user && project.createdBy === user.uid;
          return (
            <div
              key={project.id}
              className={`bg-white rounded-lg p-5 shadow-sm border ${
                isActive ? "border-orange-300" : "border-gray-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-gray-800">
                    {project.name}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {project.description || "No description yet."}
                  </div>
                </div>
                {isActive ? (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                    Active
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveProjectId(project.id)}
                  className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300"
                >
                  Select
                </button>
                <Link
                  to={`/board/${project.id}`}
                  onClick={() => setActiveProjectId(project.id)}
                  className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                >
                  Open
                </Link>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => void handleDelete(project.id, project.name)}
                    disabled={deletingId === project.id}
                    className="px-3 py-1.5 rounded-md bg-red-100 text-red-600 text-sm font-semibold hover:bg-red-200 disabled:opacity-60"
                  >
                    {deletingId === project.id ? "Deleting..." : "Delete"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {projects.length === 0 ? (
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
            <div className="text-sm text-gray-600">
              No projects yet. Create one to get started.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Projects;
