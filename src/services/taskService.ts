/* eslint-disable @typescript-eslint/no-unused-vars */
import { auth } from "../firebase";
import { Columns, TaskT, ColumnData } from "../types";
import { DEFAULT_BOARD_ID } from "./collaborationService";

export const createDefaultColumns = async (_boardId: string) => {
  console.warn(
    "createDefaultColumns via REST is not implemented yet in this demo"
  );
};

export const getBoardData = async (
  boardId = DEFAULT_BOARD_ID,
  options?: { autoInit?: boolean }
): Promise<Columns> => {
  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    const response = await fetch(`/api/board?boardId=${boardId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch board data");

    const { columns, tasks } = await response.json();

    if (columns.length === 0 && options?.autoInit !== false) {
      return {};
    }

    return buildBoard(columns, tasks);
  } catch (error) {
    console.error(error);
    return {};
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildBoard = (columnsListRaw: any[], tasksListRaw: any[]) => {
  const columnsList = columnsListRaw
    .map((data) => {
      return {
        id: data.id,
        name: data.name,
        createdAt: data.createdAt,
        wipLimit: typeof data.wipLimit === "number" ? data.wipLimit : undefined,
        stage:
          data.stage === "backlog" ||
          data.stage === "todo" ||
          data.stage === "in_progress" ||
          data.stage === "done"
            ? data.stage
            : undefined,
      };
    })
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  const board: Columns = {};
  const validColumnIds: string[] = [];

  columnsList.forEach((col) => {
    board[col.id] = {
      name: col.name,
      items: [],
      wipLimit: col.wipLimit,
      stage: col.stage,
    };
    validColumnIds.push(col.id);
  });

  tasksListRaw.forEach((data) => {
    const task: TaskT = {
      id: data.id,
      title: data.title || "Untitled",
      description: data.description || "",
      priority: data.priority || "low",
      deadline:
        typeof data.deadline === "number"
          ? data.deadline
          : Number(data.deadline) || 0,
      dueDate: typeof data.dueDate === "string" ? data.dueDate : undefined,
      assigneeId:
        typeof data.assigneeId === "string" ? data.assigneeId : undefined,
      mentions: Array.isArray(data.mentions) ? data.mentions : [],
      sprintId: typeof data.sprintId === "string" ? data.sprintId : undefined,
      image: data.image,
      alt: data.alt,
      tags: data.tags || [],
      checklist: Array.isArray(data.checklist) ? data.checklist : [],
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      timeLoggedMins:
        typeof data.timeLoggedMins === "number" ? data.timeLoggedMins : 0,
      order: typeof data.order === "number" ? data.order : undefined,
      createdAt:
        typeof data.createdAt === "number" ? data.createdAt : undefined,
      boardId: data.boardId,
      completedAt:
        typeof data.completedAt === "number" ? data.completedAt : undefined,
    };

    let status = data.status;
    if (!status || !board[status]) {
      status = validColumnIds[0];
    }

    if (board[status]) {
      board[status].items.push(task);
    }
  });

  Object.keys(board).forEach((colId) => {
    board[colId].items.sort((a, b) => {
      const aKey = a.order ?? a.createdAt ?? 0;
      const bKey = b.order ?? b.createdAt ?? 0;
      if (aKey !== bKey) return aKey - bKey;
      return a.id.localeCompare(b.id);
    });
  });

  return board;
};

export const subscribeBoardData = (
  boardId: string,
  onChange: (columns: Columns) => void,
  onError?: (error: Error) => void
) => {
  let active = true;

  const fetchAndSet = async () => {
    if (!active) return;
    try {
      const data = await getBoardData(boardId);
      if (active) onChange(data);
    } catch (e) {
      if (active && onError) onError(e as Error);
    }
  };

  fetchAndSet();
  const interval = setInterval(fetchAndSet, 5000);

  return () => {
    active = false;
    clearInterval(interval);
  };
};

export const migrateLegacyBoardData = async (_boardId = DEFAULT_BOARD_ID) => {
  return;
};

export const addColumn = async (
  name: string,
  _boardId = DEFAULT_BOARD_ID,
  options?: { wipLimit?: number; stage?: ColumnData["stage"] }
) => {
  return {
    id: "temp-id",
    name,
    wipLimit: options?.wipLimit,
    stage: options?.stage,
  };
};

export const updateColumn = async (
  _columnId: string,
  _updates: { name?: string; wipLimit?: number; stage?: ColumnData["stage"] }
) => {
  return;
};

export const deleteColumn = async (_columnId: string, _boardId: string) => {
  return;
};

export const addTask = async (
  task: TaskT,
  status: string,
  boardId = DEFAULT_BOARD_ID
) => {
  const { id, ...taskData } = task;
  const createdAt = Date.now();
  const order = typeof taskData.order === "number" ? taskData.order : createdAt;

  const rawPayload: Record<string, unknown> = {
    ...taskData,
    deadline:
      typeof taskData.deadline === "number"
        ? taskData.deadline
        : Number(taskData.deadline) || 0,
    status,
    boardId,
    createdAt,
    order,
  };

  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(rawPayload),
  });

  if (!response.ok) throw new Error("Failed to add task");

  const result = await response.json();
  return { id: result.id, ...taskData, createdAt, order, boardId };
};

export const updateTask = async (task: TaskT) => {
  const { id, ...taskData } = task;

  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  const response = await fetch("/api/tasks", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id, ...taskData }),
  });

  if (!response.ok) throw new Error("Failed to update task");
};

export const updateTaskFields = async (
  taskId: string,
  updates: Record<string, unknown>
) => {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  const response = await fetch("/api/tasks", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id: taskId, ...updates }),
  });
  if (!response.ok) throw new Error("Failed to update task fields");
};

export const updateTaskStatus = async (taskId: string, newStatus: string) => {
  await updateTaskFields(taskId, { status: newStatus });
};

export const updateTaskSprint = async (taskId: string, sprintId?: string) => {
  await updateTaskFields(taskId, { sprintId: sprintId || null });
};

export const deleteTask = async (taskId: string) => {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  const response = await fetch(`/api/tasks?id=${taskId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error("Failed to delete task");
};

export const updateColumnOrder = async (_orderedColumnIds: string[]) => {
  return;
};

export const syncTaskOrders = async (columns: Columns, columnIds: string[]) => {
  const updates: Array<{
    id: string;
    status: string;
    order: number;
    completedAt?: number | null;
  }> = [];

  columnIds.forEach((columnId) => {
    const col = columns[columnId];
    if (!col) return;
    col.items.forEach((task, index) => {
      const isDone =
        col.stage === "done" ||
        /done|closed|complete|completed|finish|selesai/i.test(col.name);

      if (task.order !== index || task.boardId !== columnId) {
        updates.push({
          id: task.id,
          status: columnId,
          order: index,
          completedAt: isDone ? task.completedAt ?? Date.now() : null,
        });
      }
    });
  });

  if (!updates.length) return;

  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  await Promise.all(
    updates.map((u) =>
      fetch("/api/tasks", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(u),
      })
    )
  );
};
