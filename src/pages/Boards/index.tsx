import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProvided,
  DraggableProvided,
} from "@hello-pangea/dnd";
import { useMemo, useState, useEffect } from "react";
import { useOutletContext, useParams } from "react-router";
import { Link } from "react-router-dom";
import { Columns, Column, TaskT } from "../../types";
import { onDragEnd } from "../../helpers/onDragEnd";
import { Plus, X, Trash2, Settings } from "lucide-react";
import AddModal from "../../components/Modals/AddModal";
import Task from "../../components/Task";
import type { LayoutOutletContext } from "../../layout";
import { useAuth, getUserLabel } from "../../context/useAuth";
import type { BoardMember } from "../../types/collaboration";
import { useBoards, getBoardRole } from "../../context/useBoards";
import { getRoleLabel, isAdminRole } from "../../helpers/roles";
import {
  subscribeBoardData,
  addTask,
  updateTask,
  deleteTask,
  addColumn,
  updateColumn,
  deleteColumn,
  syncTaskOrders,
  updateColumnOrder,
  updateTaskFields,
} from "../../services/taskService";
import { logActivity, subscribeBoardMembers } from "../../services/collaborationService";
import { subscribeSprints } from "../../services/sprintService";
import type { Sprint } from "../../types/sprints";
import { subscribeAutomationRules } from "../../services/automationService";
import type { AutomationRule } from "../../types/automation";

const Home = () => {
  const { searchQuery, uiPreferences, addNotification } =
    useOutletContext<LayoutOutletContext>();
  const { user, profile } = useAuth();
  const { boardId: paramBoardId } = useParams();
  const { activeBoardId, setActiveBoardId, activeBoard, memberships } =
    useBoards();
  const boardId = paramBoardId || activeBoardId || "";
  const boardRole = boardId ? getBoardRole(boardId, memberships) : "member";
  const canManageLists = isAdminRole(boardRole);
  const [columns, setColumns] = useState<Columns>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskT | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [columnNameDraft, setColumnNameDraft] = useState("");
  const [columnWipDraft, setColumnWipDraft] = useState("");
  const [columnStageDraft, setColumnStageDraft] = useState<
    "backlog" | "todo" | "in_progress" | "done" | ""
  >("");
  const [filters, setFilters] = useState({
    assignee: "all",
    priority: "all",
    tag: "all",
    due: "all",
    sprint: "all",
  });
  const [swimlane, setSwimlane] = useState<
    "none" | "assignee" | "priority"
  >("none");

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const isSearching = normalizedSearch.length > 0;
  const isFiltering =
    isSearching ||
    filters.assignee !== "all" ||
    filters.priority !== "all" ||
    filters.tag !== "all" ||
    filters.due !== "all" ||
    filters.sprint !== "all" ||
    swimlane !== "none";

  const activeSprint = useMemo(
    () => sprints.find((sprint) => sprint.status === "active") || null,
    [sprints]
  );

  const matchesFilters = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekAhead = new Date(today);
    weekAhead.setDate(today.getDate() + 7);

    return (task: TaskT) => {
      if (isSearching) {
        const haystack = [
          task.title,
          task.description,
          ...(task.tags || []).map((t) => t.title),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }

      if (filters.priority !== "all" && task.priority !== filters.priority) {
        return false;
      }

      if (filters.assignee !== "all" && task.assigneeId !== filters.assignee) {
        return false;
      }

      if (filters.tag !== "all") {
        const hasTag = (task.tags || []).some((tag) => tag.title === filters.tag);
        if (!hasTag) return false;
      }

      if (filters.due !== "all") {
        if (!task.dueDate) {
          return filters.due === "none";
        }
        if (filters.due === "none") return false;
        const dueTime = Date.parse(task.dueDate);
        if (Number.isNaN(dueTime)) return false;
        if (filters.due === "overdue") return dueTime < today.getTime();
        if (filters.due === "today") {
          return dueTime >= today.getTime() && dueTime < tomorrow.getTime();
        }
        if (filters.due === "week") {
          return dueTime >= today.getTime() && dueTime <= weekAhead.getTime();
        }
        return true;
      }

      if (filters.sprint !== "all") {
        if (filters.sprint === "backlog") {
          return !task.sprintId;
        }
        if (filters.sprint === "active") {
          return activeSprint ? task.sprintId === activeSprint.id : false;
        }
        return task.sprintId === filters.sprint;
      }

      return true;
    };
  }, [activeSprint, filters, isSearching, normalizedSearch]);

  useEffect(() => {
    if (paramBoardId && paramBoardId !== activeBoardId) {
      setActiveBoardId(paramBoardId);
    }
  }, [activeBoardId, paramBoardId, setActiveBoardId]);

  useEffect(() => {
    if (!boardId) return;
    let didSet = false;
    const unsubscribe = subscribeBoardData(
      boardId,
      (data) => {
        setColumns(data);
        if (!didSet) {
          setLoading(false);
          didSet = true;
        }
      },
      (error) => {
        console.error("Error fetching tasks:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [boardId]);

  useEffect(() => {
    if (!user || !boardId) return;
    return subscribeBoardMembers(boardId, setMembers);
  }, [boardId, user]);

  useEffect(() => {
    if (!boardId) {
      setSprints([]);
      return;
    }
    return subscribeSprints(boardId, setSprints);
  }, [boardId]);

  useEffect(() => {
    if (!boardId) {
      setAutomationRules([]);
      return;
    }
    return subscribeAutomationRules(boardId, setAutomationRules);
  }, [boardId]);

  if (!boardId) {
    return (
      <div className="w-full bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <div className="text-lg font-bold text-gray-800">No board selected</div>
        <div className="text-sm text-gray-600 mt-1">
          Open a project to start managing tasks.
        </div>
        <div className="mt-4">
          <Link
            to="/projects"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-400 text-white font-medium hover:bg-orange-500"
          >
            Go to Projects
          </Link>
        </div>
      </div>
    );
  }

  const openModal = (columnId: string) => {
    setSelectedColumn(columnId);
    setSelectedTask(null);
    setModalOpen(true);
  };

  const openEditModal = (task: TaskT) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedTask(null);
  };

  const startEditColumn = (columnId: string, column: Column) => {
    setEditingColumnId(columnId);
    setColumnNameDraft(column.name);
    setColumnWipDraft(
      typeof column.wipLimit === "number" && column.wipLimit > 0
        ? String(column.wipLimit)
        : ""
    );
    setColumnStageDraft(column.stage || "");
  };

  const cancelEditColumn = () => {
    setEditingColumnId(null);
  };

  const saveColumnSettings = async () => {
    if (!editingColumnId) return;
    const current = columns[editingColumnId];
    if (!current) return;
    const nextName = columnNameDraft.trim() || current.name;
    const parsedWip = columnWipDraft.trim()
      ? Number(columnWipDraft)
      : 0;
    const wipLimit = Number.isNaN(parsedWip) ? 0 : parsedWip;
    const stage = columnStageDraft || undefined;

    await updateColumn(editingColumnId, {
      name: nextName,
      wipLimit,
      stage,
    });

    setColumns((prev) => ({
      ...prev,
      [editingColumnId]: {
        ...prev[editingColumnId],
        name: nextName,
        wipLimit: wipLimit > 0 ? wipLimit : undefined,
        stage,
      },
    }));
    setEditingColumnId(null);
  };

  const isWipBlocked = (columnId: string) => {
    const limit = columns[columnId]?.wipLimit;
    if (!limit) return false;
    return columns[columnId]?.items.length >= limit;
  };

  const getSwimlaneGroups = (tasks: TaskT[]) => {
    if (swimlane === "none") {
      return [{ key: "all", label: "All tasks", tasks }];
    }

    const groups = new Map<
      string,
      { key: string; label: string; tasks: TaskT[] }
    >();

    const pushTask = (key: string, label: string, task: TaskT) => {
      const existing = groups.get(key);
      if (existing) {
        existing.tasks.push(task);
        return;
      }
      groups.set(key, { key, label, tasks: [task] });
    };

    if (swimlane === "assignee") {
      const nameById = new Map(
        members.map((member) => [member.uid, member.displayName])
      );
      tasks.forEach((task) => {
        const key = task.assigneeId || "unassigned";
        const label =
          key === "unassigned"
            ? "Unassigned"
            : nameById.get(key) || "Member";
        pushTask(key, label, task);
      });
      const orderedKeys = [
        ...members.map((member) => member.uid).filter((key) => groups.has(key)),
        ...(groups.has("unassigned") ? ["unassigned"] : []),
      ];
      const extraKeys = Array.from(groups.keys()).filter(
        (key) => !orderedKeys.includes(key)
      );
      return [...orderedKeys, ...extraKeys]
        .map((key) => groups.get(key))
        .filter(Boolean) as Array<{ key: string; label: string; tasks: TaskT[] }>;
    }

    const order = ["high", "medium", "low", "none"];
    tasks.forEach((task) => {
      const key = task.priority || "none";
      const label =
        key === "high"
          ? "High"
          : key === "medium"
          ? "Medium"
          : key === "low"
          ? "Low"
          : "None";
      pushTask(key, label, task);
    });
    const orderedKeys = order.filter((key) => groups.has(key));
    const extraKeys = Array.from(groups.keys()).filter(
      (key) => !orderedKeys.includes(key)
    );
    return [...orderedKeys, ...extraKeys]
      .map((key) => groups.get(key))
      .filter(Boolean) as Array<{ key: string; label: string; tasks: TaskT[] }>;
  };

  const applyAutomation = async (
    task: TaskT,
    trigger: "task:create" | "task:move",
    targetColumnId?: string
  ) => {
    if (!automationRules.length) return;
    const applicable = automationRules.filter((rule) => {
      if (!rule.enabled || rule.trigger !== trigger) return false;
      if (trigger === "task:move" && rule.columnId) {
        return rule.columnId === targetColumnId;
      }
      return true;
    });
    if (applicable.length === 0) return;

    const updates: Record<string, unknown> = {};
    applicable.forEach((rule) => {
      if (rule.actionType === "assign") {
        updates.assigneeId = String(rule.actionValue);
      }
      if (rule.actionType === "set_priority") {
        updates.priority = String(rule.actionValue);
      }
      if (rule.actionType === "set_due_in_days") {
        if (task.dueDate || updates.dueDate) return;
        const days = Number(rule.actionValue);
        if (!days || Number.isNaN(days)) return;
        const next = new Date();
        next.setDate(next.getDate() + days);
        updates.dueDate = next.toISOString().slice(0, 10);
      }
    });

    if (Object.keys(updates).length === 0) return;
    await updateTaskFields(task.id, updates);
    if (user) {
      await logActivity({
        boardId,
        actorUid: user.uid,
        actorName: getUserLabel(user, profile),
        message: `automation updated "${task.title}"`,
        taskId: task.id,
        type: "automation:apply",
      });
    }
  };

  const handleSaveTask = async (taskData: TaskT) => {
    try {
      const prevAssigneeId = selectedTask?.assigneeId || "";
      const nextAssigneeId = taskData.assigneeId || "";
      const prevMentions = new Set(selectedTask?.mentions || []);
      const nextMentions = new Set(taskData.mentions || []);
      let savedTaskId = taskData.id;

      if (selectedTask) {
        await updateTask(taskData);
        const newColumns = { ...columns };
        Object.keys(newColumns).forEach((colId) => {
          const taskIndex = newColumns[colId].items.findIndex(
            (t) => t.id === taskData.id
          );
          if (taskIndex > -1) {
            newColumns[colId].items[taskIndex] = taskData;
          }
        });
        setColumns(newColumns);
        addNotification(`Updated task: ${taskData.title}`);
        if (user) {
          void logActivity({
            boardId,
            actorUid: user.uid,
            actorName: getUserLabel(user, profile),
            message: `updated task "${taskData.title}"`,
            taskId: taskData.id,
            type: "task:update",
          });
        }
      } else {
        if (isWipBlocked(selectedColumn)) {
          addNotification("WIP limit reached for this list.");
          return;
        }
        const resolvedSprintId =
          taskData.sprintId ||
          (filters.sprint === "backlog"
            ? undefined
            : filters.sprint === "active"
            ? activeSprint?.id
            : filters.sprint === "all"
            ? activeSprint?.id
            : filters.sprint);
        const newTask = await addTask(
          { ...taskData, sprintId: resolvedSprintId },
          selectedColumn,
          boardId
        );
        const newBoard = { ...columns };
        newBoard[selectedColumn].items.push(newTask as TaskT);
        setColumns(newBoard);
        addNotification(`Added task: ${(newTask as TaskT).title}`);
        savedTaskId = (newTask as TaskT).id;
        if (user) {
          void logActivity({
            boardId,
            actorUid: user.uid,
            actorName: getUserLabel(user, profile),
            message: `added task "${(newTask as TaskT).title}"`,
            taskId: savedTaskId,
            type: "task:add",
          });
        }
        void applyAutomation(newTask as TaskT, "task:create");
      }

      if (user && nextAssigneeId && nextAssigneeId !== prevAssigneeId) {
        const assigneeName =
          members.find((member) => member.uid === nextAssigneeId)?.displayName ||
          "someone";
        void logActivity({
          boardId,
          actorUid: user.uid,
          actorName: getUserLabel(user, profile),
          message: `assigned "${taskData.title}" to ${assigneeName}`,
          taskId: savedTaskId,
          type: "task:assign",
        });
      }

      if (user) {
        const newlyMentioned = Array.from(nextMentions).filter(
          (id) => !prevMentions.has(id)
        );
        if (newlyMentioned.length > 0) {
          const names = newlyMentioned
            .map(
              (id) =>
                members.find((member) => member.uid === id)?.displayName || "someone"
            )
            .join(", ");
          void logActivity({
            boardId,
            actorUid: user.uid,
            actorName: getUserLabel(user, profile),
            message: `mentioned ${names} in "${taskData.title}"`,
            taskId: savedTaskId,
            type: "task:mention",
          });
        }
      }
      closeModal();
    } catch (error) {
      console.error("Error saving task:", error);
      addNotification("Failed to save task.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const existingTask = Object.values(columns)
        .flatMap((c) => c.items)
        .find((t) => t.id === taskId);
      await deleteTask(taskId);
      const newColumns = { ...columns };
      Object.keys(newColumns).forEach((colId) => {
        newColumns[colId].items = newColumns[colId].items.filter(
          (t) => t.id !== taskId
        );
      });
      setColumns(newColumns);
      closeModal();
      addNotification(
        existingTask?.title ? `Deleted task: ${existingTask.title}` : "Deleted task."
      );
      if (user) {
        void logActivity({
          boardId,
          actorUid: user.uid,
          actorName: getUserLabel(user, profile),
          message: existingTask?.title
            ? `deleted task "${existingTask.title}"`
            : "deleted a task",
          taskId,
          type: "task:delete",
        });
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      addNotification("Failed to delete task.");
    }
  };

  const handleAddColumn = async () => {
    if (!canManageLists) {
      addNotification("Only admins can add lists.");
      return;
    }
    if (!newColumnTitle.trim()) return;
    try {
      const newCol = await addColumn(newColumnTitle, boardId);
      setColumns({
        ...columns,
        [newCol.id]: { name: newCol.name, items: [] },
      });
      setNewColumnTitle("");
      setIsAddingColumn(false);
      addNotification(`Added list: ${newCol.name}`);
      if (user) {
        void logActivity({
          boardId,
          actorUid: user.uid,
          actorName: getUserLabel(user, profile),
          message: `added list "${newCol.name}"`,
          columnId: newCol.id,
          type: "column:add",
        });
      }
    } catch (error) {
      console.error("Error adding column:", error);
      addNotification("Failed to add list.");
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!canManageLists) {
      addNotification("Only admins can delete lists.");
      return;
    }
    if (
      !window.confirm(
        "Are you sure you want to delete this list? All tasks in it will be lost."
      )
    )
      return;
    try {
      const colName = columns[columnId]?.name;
      await deleteColumn(columnId);
      const newColumns = { ...columns };
      delete newColumns[columnId];
      setColumns(newColumns);
      addNotification(colName ? `Deleted list: ${colName}` : "Deleted list.");
      if (user) {
        void logActivity({
          boardId,
          actorUid: user.uid,
          actorName: getUserLabel(user, profile),
          message: colName ? `deleted list "${colName}"` : "deleted a list",
          columnId,
          type: "column:delete",
        });
      }
    } catch (error) {
      console.error("Error deleting column:", error);
      addNotification("Failed to delete list.");
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId, type } = result;

    if (!destination) return;

    if (type !== "COLUMN" && source.droppableId !== destination.droppableId) {
      if (isWipBlocked(destination.droppableId)) {
        const destName =
          columns[destination.droppableId]?.name || "that list";
        addNotification(`WIP limit reached for ${destName}.`);
        return;
      }
    }

    if (type !== "COLUMN" && source.droppableId !== destination.droppableId) {
      const taskTitle =
        columns[source.droppableId]?.items.find((t) => t.id === draggableId)
          ?.title || "Task";
      const destName = columns[destination.droppableId]?.name || "list";
      addNotification(`Moved "${taskTitle}" to ${destName}`);
      if (user) {
        void logActivity({
          boardId,
          actorUid: user.uid,
          actorName: getUserLabel(user, profile),
          message: `moved "${taskTitle}" to ${destName}`,
          taskId: draggableId,
          type: "task:move",
        });
      }
      const movedTask = columns[source.droppableId]?.items.find(
        (t) => t.id === draggableId
      );
      if (movedTask) {
        void applyAutomation(movedTask, "task:move", destination.droppableId);
      }
    }

    setColumns((prev) => {
      const next = onDragEnd(result, prev);

      if (type === "COLUMN") {
        void updateColumnOrder(Object.keys(next)).catch((error) => {
          console.error("Failed to save column order:", error);
          addNotification("Failed to save list order.");
        });
        if (user) {
          void logActivity({
            boardId,
            actorUid: user.uid,
            actorName: getUserLabel(user, profile),
            message: "reordered lists",
            type: "column:reorder",
          });
        }
        return next;
      }

      const affectedColumnIds =
        source.droppableId === destination.droppableId
          ? [source.droppableId]
          : [source.droppableId, destination.droppableId];

      void syncTaskOrders(next, affectedColumnIds).catch((error) => {
        console.error("Failed to save task order:", error);
        addNotification("Failed to save task order.");
      });

      return next;
    });
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <span className="text-xl font-bold text-gray-500">
          Loading Board...
        </span>
      </div>
    );
  }

  if (!boardId) {
    return (
      <div className="w-full flex items-center justify-center py-10">
        <div className="bg-white rounded-lg p-5 shadow-sm">
          <div className="text-lg font-bold text-gray-800">No board yet</div>
          <div className="text-sm text-gray-600 mt-2">
            Create a board to start managing tasks.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full flex flex-col gap-4 pb-2">
        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xl font-bold text-gray-800">
              {activeBoard?.name || "Board"}
            </div>
            <div className="text-sm text-gray-600">
              {activeBoard?.description || "Manage tasks and collaboration."}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {activeSprint ? `Active sprint: ${activeSprint.name}` : "No active sprint"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {members.slice(0, 5).map((member) => (
                <div
                  key={member.id}
                  className="w-8 h-8 rounded-full bg-indigo-600 text-white text-[11px] font-bold grid place-items-center border-2 border-white"
                  title={member.displayName}
                >
                  {member.displayName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-xs font-semibold text-gray-500 capitalize">
              {getRoleLabel(boardRole)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
          <select
            value={filters.assignee}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, assignee: e.target.value }))
            }
            className="h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
          >
            <option value="all">All assignees</option>
            {members.map((member) => (
              <option key={member.uid} value={member.uid}>
                {member.displayName}
              </option>
            ))}
          </select>
          <select
            value={filters.priority}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, priority: e.target.value }))
            }
            className="h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
          >
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filters.tag}
            onChange={(e) => setFilters((prev) => ({ ...prev, tag: e.target.value }))}
            className="h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
          >
            <option value="all">All tags</option>
            {Array.from(
              new Set(
                Object.values(columns)
                  .flatMap((col) => col.items)
                  .flatMap((task) => (task.tags || []).map((tag) => tag.title))
              )
            )
              .filter(Boolean)
              .sort()
              .map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
          </select>
          <select
            value={filters.due}
            onChange={(e) => setFilters((prev) => ({ ...prev, due: e.target.value }))}
            className="h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
          >
            <option value="all">All due dates</option>
            <option value="today">Due today</option>
            <option value="week">Due this week</option>
            <option value="overdue">Overdue</option>
            <option value="none">No due date</option>
          </select>
          <select
            value={filters.sprint}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, sprint: e.target.value }))
            }
            className="h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
          >
            <option value="all">All sprints</option>
            <option value="active">Active sprint</option>
            <option value="backlog">Backlog only</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
              </option>
            ))}
          </select>
          <select
            value={swimlane}
            onChange={(e) =>
              setSwimlane(e.target.value as "none" | "assignee" | "priority")
            }
            className="h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
          >
            <option value="none">No swimlane</option>
            <option value="assignee">Swimlane: Assignee</option>
            <option value="priority">Swimlane: Priority</option>
          </select>
          <button
            type="button"
            onClick={() =>
              (() => {
                setFilters({
                  assignee: "all",
                  priority: "all",
                  tag: "all",
                  due: "all",
                  sprint: "all",
                });
                setSwimlane("none");
              })()
            }
            className="h-9 px-3 rounded-md bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200"
          >
            Clear filters
          </button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable
          droppableId="all-columns"
          direction="horizontal"
          type="COLUMN"
          isDropDisabled={isFiltering}
        >
          {(provided: DroppableProvided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="w-full h-full flex items-start px-5 pb-8 gap-6 overflow-x-auto"
            >
              {Object.entries(columns).map(
                ([columnId, column]: [string, Column], index: number) => (
                  <Draggable
                    draggableId={columnId}
                    index={index}
                    key={columnId}
                    isDragDisabled={isFiltering}
                  >
                    {(provided: DraggableProvided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="flex flex-col gap-0 min-w-[290px]"
                      >
                        <Droppable
                          droppableId={columnId}
                          key={columnId}
                          isDropDisabled={isFiltering}
                        >
                          {(droppableProvided: DroppableProvided) => (
                            <div
                              ref={droppableProvided.innerRef}
                              {...droppableProvided.droppableProps}
                              className="flex flex-col w-full gap-3 items-center py-5"
                            >
                              <div
                                {...provided.dragHandleProps}
                                className={`flex items-center justify-between py-[10px] w-full bg-white rounded-lg shadow-sm text-[#555] font-medium text-[15px] px-3 ${
                                  column.wipLimit &&
                                  column.items.length >= column.wipLimit
                                    ? "border border-red-200"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {column.name}
                                  <span className="bg-gray-200 text-xs px-2 py-1 rounded-full text-gray-600">
                                    {isFiltering
                                      ? `${column.items.filter(matchesFilters).length} / ${column.items.length}`
                                      : column.wipLimit
                                      ? `${column.items.length} / ${column.wipLimit}`
                                      : column.items.length}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {canManageLists ? (
                                    <button
                                      type="button"
                                      onClick={() => startEditColumn(columnId, column)}
                                      className="text-gray-400 hover:text-gray-700"
                                      title="Column settings"
                                    >
                                      <Settings size={16} />
                                    </button>
                                  ) : null}
                                  <Trash2
                                    size={18}
                                    className="text-gray-400 hover:text-red-500 cursor-pointer"
                                    onClick={() => handleDeleteColumn(columnId)}
                                  />
                                </div>
                              </div>

                              {editingColumnId === columnId ? (
                                <div className="w-full bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                                  <div className="flex flex-col gap-2">
                                    <input
                                      type="text"
                                      value={columnNameDraft}
                                      onChange={(e) => setColumnNameDraft(e.target.value)}
                                      className="w-full h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
                                      placeholder="List name"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                      <input
                                        type="number"
                                        min={0}
                                        value={columnWipDraft}
                                        onChange={(e) =>
                                          setColumnWipDraft(e.target.value)
                                        }
                                        className="w-full h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
                                        placeholder="WIP limit"
                                      />
                                      <select
                                        value={columnStageDraft}
                                        onChange={(e) =>
                                          setColumnStageDraft(
                                            e.target.value as
                                              | "backlog"
                                              | "todo"
                                              | "in_progress"
                                              | "done"
                                              | ""
                                          )
                                        }
                                        className="w-full h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
                                      >
                                        <option value="">Stage (auto)</option>
                                        <option value="backlog">Backlog</option>
                                        <option value="todo">To do</option>
                                        <option value="in_progress">In progress</option>
                                        <option value="done">Done</option>
                                      </select>
                                    </div>
                                    <div className="flex items-center gap-2 justify-end">
                                      <button
                                        type="button"
                                        onClick={cancelEditColumn}
                                        className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={saveColumnSettings}
                                        className="px-3 py-1.5 rounded-md bg-orange-400 text-white text-xs font-semibold hover:bg-orange-500"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : null}

                              {(() => {
                                const visibleTasks = column.items.filter(matchesFilters);
                                const groups = getSwimlaneGroups(visibleTasks);
                                let taskIndex = 0;
                                return groups.map((group) => (
                                  <div key={group.key} className="w-full flex flex-col gap-2">
                                    {swimlane !== "none" ? (
                                      <div className="w-full text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                        {group.label}
                                      </div>
                                    ) : null}
                                    {group.tasks.map((task: TaskT) => {
                                      const index = taskIndex;
                                      taskIndex += 1;
                                      return (
                                        <Draggable
                                          key={task.id.toString()}
                                          draggableId={task.id.toString()}
                                          index={index}
                                          isDragDisabled={isFiltering}
                                        >
                                          {(provided: DraggableProvided) => (
                                            <Task
                                              provided={provided}
                                              task={task}
                                              onClick={openEditModal}
                                              assignee={members.find(
                                                (m) => m.uid === task.assigneeId
                                              )}
                                              uiPreferences={uiPreferences}
                                            />
                                          )}
                                        </Draggable>
                                      );
                                    })}
                                  </div>
                                ));
                              })()}
                              {droppableProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                        <div
                          onClick={() => openModal(columnId)}
                          className="flex cursor-pointer items-center justify-center gap-1 py-[10px] w-full opacity-90 bg-white rounded-lg shadow-sm text-[#555] font-medium text-[15px] hover:bg-gray-50 transition-colors"
                        >
                          <Plus color={"#555"} size={20} />
                          Add Task
                        </div>
                      </div>
                    )}
                  </Draggable>
                )
              )}
              {provided.placeholder}

              <div className="min-w-[290px] py-5">
                {!isAddingColumn ? (
                  <div
                    onClick={() => {
                      if (canManageLists) setIsAddingColumn(true);
                    }}
                    className={`w-full rounded-lg p-3 flex items-center gap-2 font-medium transition-all ${
                      canManageLists
                        ? "bg-white/50 hover:bg-white/80 cursor-pointer text-gray-700"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <Plus size={20} />
                    <span>
                      {canManageLists ? "Add another list" : "Admin only"}
                    </span>
                  </div>
                ) : (
                  <div className="w-full bg-white rounded-lg p-3 shadow-sm flex flex-col gap-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Enter list title..."
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:border-orange-400"
                      value={newColumnTitle}
                      onChange={(e) => setNewColumnTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddColumn}
                        className="px-3 py-1 bg-orange-400 text-white rounded text-sm hover:bg-orange-500"
                      >
                        Add list
                      </button>
                      <X
                        size={20}
                        className="cursor-pointer text-gray-500 hover:text-gray-700"
                        onClick={() => setIsAddingColumn(false)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <AddModal
        isOpen={modalOpen}
        onClose={closeModal}
        setOpen={setModalOpen}
        handleAddTask={handleSaveTask}
        selectedTask={selectedTask}
        handleDeleteTask={handleDeleteTask}
        members={members}
        currentUserId={user?.uid}
      />
    </>
  );
};

export default Home;
