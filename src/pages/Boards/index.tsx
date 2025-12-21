import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { useMemo, useState, useEffect } from "react";
import { useOutletContext, useParams } from "react-router";
import { Link } from "react-router-dom";
import type { Columns, Column, TaskT } from "../../types";
import { onDragEnd } from "../../helpers/onDragEnd";
import { RefreshCw } from "lucide-react";
import AddModal from "../../components/Modals/AddModal";
import type { LayoutOutletContext } from "../../layout";
import { useAuth, getUserLabel } from "../../context/useAuth";
import type { BoardMember } from "../../types/collaboration";
import { useBoards, getBoardRole } from "../../context/useBoards";
import { getRoleLabel, isAdminRole } from "../../helpers/roles";
import BoardHeader from "./BoardHeader";
import BoardFiltersBar from "./BoardFiltersBar";
import ColumnCard from "./ColumnCard";
import AddColumnCard from "./AddColumnCard";
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
  createDefaultColumns,
} from "../../services/taskService";
import {
  logActivity,
  subscribeBoardMembers,
} from "../../services/collaborationService";
import { subscribeSprints } from "../../services/sprintService";
import type { Sprint } from "../../types/sprints";
import { subscribeAutomationRules } from "../../services/automationService";
import type { AutomationRule } from "../../types/automation";
import {
  DEFAULT_BOARD_FILTERS,
  type BoardFilters,
  type ColumnEditState,
  type SwimlaneMode,
} from "./boardTypes";

type BoardsPageProps = {
  boardId?: string;
};

const BoardsPage = ({ boardId: boardIdProp }: BoardsPageProps) => {
  const { searchQuery, uiPreferences, addNotification } =
    useOutletContext<LayoutOutletContext>();
  const { user, profile } = useAuth();
  const { boardId: paramBoardId } = useParams();
  const { activeBoardId, setActiveBoardId, activeBoard, memberships } =
    useBoards();
  const boardId = boardIdProp || paramBoardId || activeBoardId || "";
  const boardRole = boardId ? getBoardRole(boardId, memberships) : "member";
  const canManageLists = isAdminRole(boardRole);
  const [columns, setColumns] = useState<Columns>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskT | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [filters, setFilters] = useState<BoardFilters>({
    ...DEFAULT_BOARD_FILTERS,
  });
  const [swimlane, setSwimlane] = useState<SwimlaneMode>("none");
  const [columnEdit, setColumnEdit] = useState<ColumnEditState>({
    columnId: null,
    name: "",
    wipLimit: "",
    stage: "",
  });

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

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    Object.values(columns).forEach((col) => {
      col.items.forEach((task) => {
        (task.tags || []).forEach((tag) => {
          if (tag?.title) tags.add(tag.title);
        });
      });
    });
    return Array.from(tags).sort();
  }, [columns]);

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
        const hasTag = (task.tags || []).some(
          (tag) => tag.title === filters.tag
        );
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
    if (boardIdProp && boardIdProp !== activeBoardId) {
      setActiveBoardId(boardIdProp);
      return;
    }
    if (paramBoardId && paramBoardId !== activeBoardId) {
      setActiveBoardId(paramBoardId);
    }
  }, [activeBoardId, boardIdProp, paramBoardId, setActiveBoardId]);

  const describeTaskSaveError = (e: unknown) => {
    if (e && typeof e === "object") {
      const code =
        "code" in e ? String((e as { code?: unknown }).code) : "";
      const message =
        "message" in e ? String((e as { message?: unknown }).message) : "";
      if (code === "permission-denied") {
        return `Permission denied while saving the task (board: ${boardId}). Make sure \`firestore.rules\` has been deployed to your Firebase project.`;
      }
      return message || "Failed to save task.";
    }
    return "Failed to save task.";
  };

  const describeSnapshotError = (label: string, e: unknown) => {
    if (e && typeof e === "object") {
      const code =
        "code" in e ? String((e as { code?: unknown }).code) : "";
      const message =
        "message" in e ? String((e as { message?: unknown }).message) : "";
      if (code === "permission-denied") {
        return `${label}: permission denied (board: ${boardId}).`;
      }
      return message ? `${label}: ${message}` : `${label}: failed.`;
    }
    return `${label}: failed.`;
  };

  useEffect(() => {
    if (!boardId) return;
    setLoading(true);
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
    return subscribeBoardMembers(boardId, setMembers, (error) => {
      console.error("Error fetching board members:", error);
      addNotification(describeSnapshotError("Failed to load members", error));
    });
  }, [addNotification, boardId, user]);

  useEffect(() => {
    if (!boardId) {
      setSprints([]);
      return;
    }
    return subscribeSprints(boardId, setSprints, (error) => {
      console.error("Error fetching sprints:", error);
      addNotification(describeSnapshotError("Failed to load sprints", error));
    });
  }, [addNotification, boardId]);

  useEffect(() => {
    if (!boardId) {
      setAutomationRules([]);
      return;
    }
    return subscribeAutomationRules(boardId, setAutomationRules, (error) => {
      console.error("Error fetching automations:", error);
      addNotification(describeSnapshotError("Failed to load automations", error));
    });
  }, [addNotification, boardId]);

  const handleInitializeBoard = async () => {
    if (!boardId || initializing) return;
    setInitializing(true);
    try {
      await createDefaultColumns(boardId);
      addNotification("Board initialized successfully.");
    } catch (e) {
      console.error("Failed to init board", e);
      addNotification("Failed to initialize board.");
    } finally {
      setInitializing(false);
    }
  };

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

  const openAddTaskModal = (columnId: string) => {
    setSelectedColumn(columnId);
    setSelectedTask(null);
    setModalOpen(true);
  };

  const openEditTaskModal = (task: TaskT) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedTask(null);
  };

  const startEditColumn = (columnId: string, column: Column) => {
    setColumnEdit({
      columnId,
      name: column.name,
      wipLimit:
        typeof column.wipLimit === "number" && column.wipLimit > 0
          ? String(column.wipLimit)
          : "",
      stage: column.stage || "",
    });
  };

  const cancelEditColumn = () => {
    setColumnEdit({ columnId: null, name: "", wipLimit: "", stage: "" });
  };

  const saveColumnSettings = async () => {
    if (!columnEdit.columnId) return;
    const columnId = columnEdit.columnId;
    const current = columns[columnId];
    if (!current) return;
    const nextName = columnEdit.name.trim() || current.name;
    const parsedWip = columnEdit.wipLimit.trim()
      ? Number(columnEdit.wipLimit)
      : 0;
    const wipLimit = Number.isNaN(parsedWip) ? 0 : parsedWip;
    const stage = columnEdit.stage || undefined;

    await updateColumn(columnId, {
      name: nextName,
      wipLimit,
      stage,
    });

    setColumns((prev) => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        name: nextName,
        wipLimit: wipLimit > 0 ? wipLimit : undefined,
        stage,
      },
    }));
    setColumnEdit({ columnId: null, name: "", wipLimit: "", stage: "" });
  };

  const isWipBlocked = (columnId: string) => {
    const limit = columns[columnId]?.wipLimit;
    if (!limit) return false;
    return columns[columnId]?.items.length >= limit;
  };

  const handleClearFilters = () => {
    setFilters({ ...DEFAULT_BOARD_FILTERS });
    setSwimlane("none");
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
          members.find((member) => member.uid === nextAssigneeId)
            ?.displayName || "someone";
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
                members.find((member) => member.uid === id)?.displayName ||
                "someone"
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
      addNotification(describeTaskSaveError(error));
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
        existingTask?.title
          ? `Deleted task: ${existingTask.title}`
          : "Deleted task."
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

  const handleAddColumn = async (title: string): Promise<boolean> => {
    if (!canManageLists) {
      addNotification("Only admins can add lists.");
      return false;
    }
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return false;
    try {
      const newCol = await addColumn(normalizedTitle, boardId);
      setColumns((prev) => ({
        ...prev,
        [newCol.id]: { name: newCol.name, items: [] },
      }));
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
      return true;
    } catch (error) {
      console.error("Error adding column:", error);
      addNotification("Failed to add list.");
      return false;
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
      await deleteColumn(columnId, boardId);
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
      addNotification(describeSnapshotError("Failed to delete list", error));
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId, type } = result;

    if (!destination) return;

    if (type !== "COLUMN" && source.droppableId !== destination.droppableId) {
      if (isWipBlocked(destination.droppableId)) {
        const destName = columns[destination.droppableId]?.name || "that list";
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

  // Jika tidak loading tapi kolom kosong, tampilkan tombol inisialisasi
  if (Object.keys(columns).length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12 gap-4">
        <div className="text-xl font-bold text-gray-800">Ready to work?</div>
        <div className="text-gray-600">
          This board is empty. Initialize default lists to get started.
        </div>
        <button
          onClick={handleInitializeBoard}
          disabled={initializing}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50"
        >
          {initializing ? (
            <>
              <RefreshCw className="animate-spin" size={18} />
              Initializing...
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              Initialize Board
            </>
          )}
        </button>
        {canManageLists && (
          <div className="mt-4 text-sm text-gray-500">
            Or use the button below to add a custom list manually.
          </div>
        )}
        {canManageLists && (
          <div className="mt-2 min-w-[300px]">
            <AddColumnCard
              canManage={canManageLists}
              onAdd={handleAddColumn}
              variant="empty"
              addText="Add a custom list"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="w-full flex flex-col gap-4 pb-2">
        <BoardHeader
          title={activeBoard?.name || "Board"}
          description={
            activeBoard?.description || "Manage tasks and collaboration."
          }
          sprintText={
            activeSprint
              ? `Active sprint: ${activeSprint.name}`
              : "No active sprint"
          }
          members={members}
          roleLabel={getRoleLabel(boardRole)}
        />

        <BoardFiltersBar
          filters={filters}
          swimlane={swimlane}
          tags={availableTags}
          members={members}
          sprints={sprints}
          onChangeFilters={(patch) =>
            setFilters((prev) => ({ ...prev, ...patch }))
          }
          onChangeSwimlane={setSwimlane}
          onClear={handleClearFilters}
        />
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable
          droppableId="all-columns"
          direction="horizontal"
          type="COLUMN"
          isDropDisabled={isFiltering}
        >
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="w-full h-full flex items-start px-5 pb-8 gap-6 overflow-x-auto"
            >
              {Object.entries(columns).map(([columnId, column], index) => (
                <Draggable
                  draggableId={columnId}
                  index={index}
                  key={columnId}
                  isDragDisabled={isFiltering}
                >
                  {(columnProvided) => (
                    <ColumnCard
                      columnId={columnId}
                      column={column}
                      provided={columnProvided}
                      isFiltering={isFiltering}
                      canManageLists={canManageLists}
                      members={members}
                      uiPreferences={uiPreferences}
                      swimlane={swimlane}
                      matchesFilters={matchesFilters}
                      columnEdit={columnEdit}
                      onStartEdit={startEditColumn}
                      onChangeEdit={(patch) =>
                        setColumnEdit((prev) => ({ ...prev, ...patch }))
                      }
                      onCancelEdit={cancelEditColumn}
                      onSaveEdit={saveColumnSettings}
                      onOpenAddTask={openAddTaskModal}
                      onOpenTask={openEditTaskModal}
                      onDeleteColumn={handleDeleteColumn}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              <div className="min-w-[290px] py-5">
                <AddColumnCard
                  canManage={canManageLists}
                  onAdd={handleAddColumn}
                  variant="board"
                  addText="Add another list"
                  disabledText="Admin only"
                />
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

export default BoardsPage;
