import { useEffect, useMemo, useState } from "react";
import { useAuth, getUserLabel } from "../../context/useAuth";
import { useBoards } from "../../context/useBoards";
import { subscribeBoardData, updateTaskSprint } from "../../services/taskService";
import {
  createSprint,
  deleteSprint,
  setSprintStatus,
  subscribeSprints,
} from "../../services/sprintService";
import { logActivity } from "../../services/collaborationService";
import type { Columns, TaskT } from "../../types";
import type { Sprint } from "../../types/sprints";

type TaskRow = TaskT & { columnName: string };

const formatSprintDates = (sprint: Sprint) => {
  if (!sprint.startDate && !sprint.endDate) return "No dates set";
  return `${sprint.startDate || "?"} - ${sprint.endDate || "?"}`;
};

const Backlog = () => {
  const { user, profile } = useAuth();
  const { activeBoardId } = useBoards();
  const [columns, setColumns] = useState<Columns>({});
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!activeBoardId) {
      setColumns({});
      setLoading(false);
      return;
    }
    let didSet = false;
    const unsubscribe = subscribeBoardData(activeBoardId, (data) => {
      setColumns(data);
      if (!didSet) {
        setLoading(false);
        didSet = true;
      }
    });
    return () => unsubscribe();
  }, [activeBoardId]);

  useEffect(() => {
    if (!activeBoardId) {
      setSprints([]);
      return;
    }
    return subscribeSprints(activeBoardId, setSprints);
  }, [activeBoardId]);

  const allTasks = useMemo<TaskRow[]>(() => {
    const rows: TaskRow[] = [];
    Object.values(columns).forEach((col) => {
      col.items.forEach((task) => {
        rows.push({ ...task, columnName: col.name });
      });
    });
    return rows;
  }, [columns]);

  const backlogTasks = useMemo(
    () => allTasks.filter((task) => !task.sprintId),
    [allTasks]
  );

  const tasksBySprint = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    allTasks.forEach((task) => {
      if (!task.sprintId) return;
      const existing = map.get(task.sprintId) || [];
      map.set(task.sprintId, [...existing, task]);
    });
    return map;
  }, [allTasks]);

  const handleCreateSprint = async () => {
    if (!activeBoardId || !user || !name.trim()) return;
    setCreating(true);
    try {
      const sprint = await createSprint({
        boardId: activeBoardId,
        name,
        goal,
        startDate,
        endDate,
        createdBy: user.uid,
      });
      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
      await logActivity({
        boardId: activeBoardId,
        actorUid: user.uid,
        actorName: getUserLabel(user, profile),
        message: `created sprint "${sprint.name}"`,
        type: "sprint:create",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleMoveTask = async (task: TaskRow, sprintId?: string) => {
    if (!activeBoardId || !user) return;
    await updateTaskSprint(task.id, sprintId);
    await logActivity({
      boardId: activeBoardId,
      actorUid: user.uid,
      actorName: getUserLabel(user, profile),
      message: sprintId
        ? `moved "${task.title}" to a sprint`
        : `moved "${task.title}" to backlog`,
      taskId: task.id,
      type: "task:sprint",
    });
  };

  const handleStatus = async (sprint: Sprint, status: Sprint["status"]) => {
    if (!activeBoardId || !user) return;
    await setSprintStatus(activeBoardId, sprint.id, status);
    await logActivity({
      boardId: activeBoardId,
      actorUid: user.uid,
      actorName: getUserLabel(user, profile),
      message: `marked sprint "${sprint.name}" as ${status}`,
      type: "sprint:update",
    });
  };

  const handleDeleteSprint = async (sprint: Sprint) => {
    if (!activeBoardId || !user) return;
    if (!window.confirm(`Delete sprint "${sprint.name}"? Tasks will go to backlog.`)) {
      return;
    }
    await deleteSprint(sprint.id);
    await logActivity({
      boardId: activeBoardId,
      actorUid: user.uid,
      actorName: getUserLabel(user, profile),
      message: `deleted sprint "${sprint.name}"`,
      type: "sprint:delete",
    });
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-10">
        <span className="text-lg font-semibold text-gray-200">
          Loading backlog...
        </span>
      </div>
    );
  }

  if (!activeBoardId) {
    return (
      <div className="w-full bg-white rounded-lg p-5 shadow-sm">
        <div className="text-lg font-bold text-gray-800">Backlog</div>
        <div className="text-sm text-gray-600 mt-1">
          Select a board to manage sprints.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-8">
      <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
        <div className="text-lg font-bold text-gray-800">Backlog & sprints</div>
        <div className="text-sm text-gray-600">
          Plan work by assigning tasks to sprints.
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
        <div className="text-sm font-semibold text-gray-800">
          Create new sprint
        </div>
        <div className="mt-3 grid md:grid-cols-4 grid-cols-1 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sprint name"
            className="h-10 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
          />
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Sprint goal"
            className="h-10 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleCreateSprint}
          disabled={creating || !name.trim()}
          className="mt-3 px-4 py-2 rounded-md bg-orange-400 text-white text-sm font-semibold hover:bg-orange-500 disabled:opacity-60"
        >
          {creating ? "Creating..." : "Create sprint"}
        </button>
      </div>

      <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold text-gray-800">Backlog</div>
            <div className="text-sm text-gray-500">
              {backlogTasks.length} tasks
            </div>
          </div>
          {backlogTasks.length === 0 ? (
            <div className="mt-4 text-sm text-gray-600">
              No backlog tasks.
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {backlogTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-800">
                      {task.title}
                    </span>
                    <span className="text-xs text-gray-500">
                      {task.columnName}
                    </span>
                  </div>
                  <select
                    value={task.sprintId || ""}
                    onChange={(e) =>
                      handleMoveTask(
                        task,
                        e.target.value ? e.target.value : undefined
                      )
                    }
                    className="h-8 px-2 rounded-md bg-white border border-gray-200 text-xs"
                  >
                    <option value="">Backlog</option>
                    {sprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {sprints.length === 0 ? (
            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 text-sm text-gray-600">
              No sprints yet. Create one to start planning.
            </div>
          ) : (
            sprints.map((sprint) => {
              const sprintTasks = tasksBySprint.get(sprint.id) || [];
              return (
                <div
                  key={sprint.id}
                  className="bg-white rounded-lg p-5 shadow-sm border border-gray-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-gray-800">
                        {sprint.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {sprint.goal || "No goal set."}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatSprintDates(sprint)}
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-xs font-semibold text-gray-700 capitalize">
                      {sprint.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {sprint.status === "planned" ? (
                      <button
                        type="button"
                        onClick={() => handleStatus(sprint, "active")}
                        className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                      >
                        Start sprint
                      </button>
                    ) : null}
                    {sprint.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => handleStatus(sprint, "completed")}
                        className="px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-semibold hover:bg-green-700"
                      >
                        Complete sprint
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDeleteSprint(sprint)}
                      className="px-3 py-1.5 rounded-md bg-red-100 text-red-600 text-xs font-semibold hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs text-gray-500 mb-2">
                      {sprintTasks.length} tasks
                    </div>
                    {sprintTasks.length === 0 ? (
                      <div className="text-sm text-gray-600">
                        No tasks in this sprint.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {sprintTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-gray-800">
                                {task.title}
                              </span>
                              <span className="text-xs text-gray-500">
                                {task.columnName}
                              </span>
                            </div>
                            <select
                              value={task.sprintId || ""}
                              onChange={(e) =>
                                handleMoveTask(
                                  task,
                                  e.target.value ? e.target.value : undefined
                                )
                              }
                              className="h-8 px-2 rounded-md bg-white border border-gray-200 text-xs"
                            >
                              <option value="">Backlog</option>
                              {sprints.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Backlog;
