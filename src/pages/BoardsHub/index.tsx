import { useState } from "react";
import { Link } from "react-router-dom";
import { useBoards, getBoardRole } from "../../context/useBoards";
import { getRoleLabel, isAdminRole } from "../../helpers/roles";

const BoardsHub = () => {
  const {
    boards,
    memberships,
    createBoard,
    updateBoard,
    deleteBoard,
    activeBoardId,
    setActiveBoardId,
  } = useBoards();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createBoard({ name, description });
      setName("");
      setDescription("");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (boardId: string, currentName: string, currentDesc?: string) => {
    setEditingId(boardId);
    setEditName(currentName);
    setEditDescription(currentDesc || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateBoard(editingId, {
      name: editName.trim(),
      description: editDescription.trim(),
    });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-8">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <div className="text-xl font-bold text-gray-800">Boards</div>
        <div className="text-sm text-gray-600">
          Create and manage team boards.
        </div>

        <div className="mt-5 grid md:grid-cols-3 grid-cols-1 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Board name"
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
            {creating ? "Creating..." : "Create board"}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
        {boards.map((board) => {
          const role = getBoardRole(board.id, memberships);
          const canManage = isAdminRole(role);
          const isEditing = editingId === board.id;

          return (
            <div
              key={board.id}
              className={`bg-white rounded-lg p-5 shadow-sm border ${
                activeBoardId === board.id
                  ? "border-orange-300"
                  : "border-gray-100"
              }`}
            >
              {isEditing ? (
                <div className="flex flex-col gap-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-10 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="min-h-[80px] px-3 py-2 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
                  />
                </div>
              ) : (
                <div>
                  <div className="text-lg font-bold text-gray-800">
                    {board.name}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {board.description || "No description yet."}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  to={`/boards/${board.id}`}
                  onClick={() => setActiveBoardId(board.id)}
                  className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                >
                  Open
                </Link>
                <span className="text-xs font-semibold text-gray-500 capitalize">
                  {getRoleLabel(role)}
                </span>
                {canManage ? (
                  <>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="px-3 py-1.5 rounded-md bg-orange-400 text-white text-sm font-semibold hover:bg-orange-500"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            startEdit(board.id, board.name, board.description)
                          }
                          className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBoard(board.id)}
                          className="px-3 py-1.5 rounded-md bg-red-100 text-red-600 text-sm font-semibold hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        {boards.length === 0 ? (
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
            <div className="text-sm text-gray-600">
              No boards yet. Create one to get started.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BoardsHub;
