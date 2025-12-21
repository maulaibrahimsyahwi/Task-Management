import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  writeBatch,
  onSnapshot,
  deleteField,
} from "firebase/firestore";
import type { DocumentData, QuerySnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Columns, TaskT, ColumnData } from "../types";
import { DEFAULT_BOARD_ID } from "./collaborationService";

const TASK_COLLECTION = "tasks";
const COLUMN_COLLECTION = "columns";

// Menggunakan Batch agar pembuatan kolom lebih cepat dan stabil
export const createDefaultColumns = async (boardId: string) => {
  const defaults: Array<{
    name: string;
    stage: "backlog" | "todo" | "in_progress" | "done";
  }> = [
    { name: "To Do", stage: "todo" },
    { name: "Doing", stage: "in_progress" },
    { name: "Done", stage: "done" },
  ];

  const base = Date.now();
  const batch = writeBatch(db);

  defaults.forEach((def, index) => {
    const newColRef = doc(collection(db, COLUMN_COLLECTION));
    batch.set(newColRef, {
      name: def.name,
      stage: def.stage,
      createdAt: base + index,
      boardId,
    });
  });

  await batch.commit();
};

export const getBoardData = async (
  boardId = DEFAULT_BOARD_ID,
  options?: { autoInit?: boolean }
): Promise<Columns> => {
  const colRef = collection(db, COLUMN_COLLECTION);
  const qCol = query(colRef, where("boardId", "==", boardId));
  const colSnap = await getDocs(qCol);

  const autoInit = options?.autoInit !== false;

  if (colSnap.empty) {
    if (autoInit) {
      await createDefaultColumns(boardId);
      // Recursively call to get the data after creation
      return getBoardData(boardId, options);
    }
    return {};
  }

  const taskSnap = await getDocs(
    query(collection(db, TASK_COLLECTION), where("boardId", "==", boardId))
  );

  const board = buildBoard(colSnap, taskSnap);

  return board;
};

const buildBoard = (
  colSnap: QuerySnapshot<DocumentData>,
  taskSnap: QuerySnapshot<DocumentData>
) => {
  const columnsList = colSnap.docs
    .map((docSnapshot) => {
      const data = docSnapshot.data() as ColumnData;
      return {
        id: docSnapshot.id,
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

  taskSnap.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    // Validasi data task dasar
    const task: TaskT = {
      id: docSnapshot.id,
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
      // Jika status tidak valid, masukkan ke kolom pertama
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
  if (!boardId) return () => {};

  const colRef = collection(db, COLUMN_COLLECTION);
  const qCol = query(colRef, where("boardId", "==", boardId));
  const taskRef = query(
    collection(db, TASK_COLLECTION),
    where("boardId", "==", boardId)
  );

  let colSnap: QuerySnapshot<DocumentData> | null = null;
  let taskSnap: QuerySnapshot<DocumentData> | null = null;
  let initializing = false;

  const build = async () => {
    // Tunggu sampai kedua snapshot tersedia
    if (!colSnap || !taskSnap) return;

    // Jika kolom kosong dan belum proses inisialisasi, coba buat default
    if (colSnap.empty && !initializing) {
      initializing = true;
      try {
        await createDefaultColumns(boardId);
      } catch (e) {
        console.error("Auto-creation of columns failed", e);
      } finally {
        initializing = false;
      }
      // Kita return di sini agar snapshot berikutnya (setelah write) yang men-trigger update UI
      return;
    }

    const board = buildBoard(colSnap, taskSnap);
    onChange(board);
  };

  const unsubscribeColumns = onSnapshot(
    qCol,
    (snapshot) => {
      colSnap = snapshot;
      void build();
    },
    (error) => onError?.(error)
  );

  const unsubscribeTasks = onSnapshot(
    taskRef,
    (snapshot) => {
      taskSnap = snapshot;
      void build();
    },
    (error) => onError?.(error)
  );

  return () => {
    unsubscribeColumns();
    unsubscribeTasks();
  };
};

export const migrateLegacyBoardData = async (boardId = DEFAULT_BOARD_ID) => {
  const [colSnap, taskSnap] = await Promise.all([
    getDocs(collection(db, COLUMN_COLLECTION)),
    getDocs(collection(db, TASK_COLLECTION)),
  ]);

  let batch = writeBatch(db);
  let ops = 0;

  for (const docSnap of colSnap.docs) {
    const data = docSnap.data();
    if (data.boardId) continue;
    batch.update(docSnap.ref, { boardId });
    ops += 1;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  for (const docSnap of taskSnap.docs) {
    const data = docSnap.data();
    if (data.boardId) continue;
    batch.update(docSnap.ref, { boardId });
    ops += 1;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }
};

export const addColumn = async (
  name: string,
  boardId = DEFAULT_BOARD_ID,
  options?: { wipLimit?: number; stage?: ColumnData["stage"] }
) => {
  const payload: Record<string, unknown> = {
    name,
    createdAt: Date.now(),
    boardId,
  };
  if (typeof options?.wipLimit === "number") {
    payload.wipLimit = options.wipLimit;
  }
  if (options?.stage) {
    payload.stage = options.stage;
  }

  const docRef = await addDoc(collection(db, COLUMN_COLLECTION), payload);
  return {
    id: docRef.id,
    name,
    wipLimit:
      typeof options?.wipLimit === "number" ? options?.wipLimit : undefined,
    stage: options?.stage,
  };
};

export const updateColumn = async (
  columnId: string,
  updates: { name?: string; wipLimit?: number; stage?: ColumnData["stage"] }
) => {
  const payload: Record<string, unknown> = {};
  if (typeof updates.name === "string") {
    payload.name = updates.name.trim();
  }
  if (updates.wipLimit === undefined) {
    // ignore
  } else if (Number.isNaN(updates.wipLimit) || updates.wipLimit <= 0) {
    payload.wipLimit = deleteField();
  } else {
    payload.wipLimit = updates.wipLimit;
  }
  if (updates.stage !== undefined) {
    payload.stage = updates.stage;
  }
  if (Object.keys(payload).length === 0) return;
  await updateDoc(doc(db, COLUMN_COLLECTION, columnId), payload);
};

export const deleteColumn = async (columnId: string, boardId: string) => {
  const colRef = doc(db, COLUMN_COLLECTION, columnId);
  const tasksQ = query(
    collection(db, TASK_COLLECTION),
    where("boardId", "==", boardId),
    where("status", "==", columnId)
  );
  const taskSnap = await getDocs(tasksQ);

  let batch = writeBatch(db);
  let ops = 0;

  for (const taskDoc of taskSnap.docs) {
    batch.delete(taskDoc.ref);
    ops += 1;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  batch.delete(colRef);
  ops += 1;
  if (ops > 0) {
    await batch.commit();
  }
};

export const addTask = async (
  task: TaskT,
  status: string,
  boardId = DEFAULT_BOARD_ID
) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Firestore tidak menerima value `undefined`.
  const payload: Record<string, unknown> = {};
  Object.entries(rawPayload).forEach(([key, value]) => {
    if (value === undefined) return;
    payload[key] = value;
  });

  const docRef = await addDoc(collection(db, TASK_COLLECTION), payload);
  return { id: docRef.id, ...taskData, createdAt, order, boardId };
};

export const updateTask = async (task: TaskT) => {
  const { id, ...taskData } = task;
  const taskRef = doc(db, TASK_COLLECTION, id);
  const normalized: Record<string, unknown> = {};
  Object.entries(taskData).forEach(([key, value]) => {
    if (value === undefined) return;
    normalized[key] = value;
  });
  normalized.deadline =
    typeof taskData.deadline === "number"
      ? taskData.deadline
      : Number(taskData.deadline) || 0;
  await updateDoc(taskRef, normalized);
};

export const updateTaskFields = async (
  taskId: string,
  updates: Record<string, unknown>
) => {
  if (Object.keys(updates).length === 0) return;
  const taskRef = doc(db, TASK_COLLECTION, taskId);
  await updateDoc(taskRef, updates);
};

export const updateTaskStatus = async (taskId: string, newStatus: string) => {
  const taskRef = doc(db, TASK_COLLECTION, taskId);
  await updateDoc(taskRef, { status: newStatus });
};

export const updateTaskSprint = async (taskId: string, sprintId?: string) => {
  const taskRef = doc(db, TASK_COLLECTION, taskId);
  await updateDoc(taskRef, {
    sprintId: sprintId ? sprintId : deleteField(),
  });
};

export const deleteTask = async (taskId: string) => {
  const taskRef = doc(db, TASK_COLLECTION, taskId);
  await deleteDoc(taskRef);
};

export const updateColumnOrder = async (orderedColumnIds: string[]) => {
  if (!orderedColumnIds.length) return;
  const base = Date.now();
  const batch = writeBatch(db);
  orderedColumnIds.forEach((columnId, index) => {
    batch.update(doc(db, COLUMN_COLLECTION, columnId), {
      createdAt: base + index,
    });
  });
  await batch.commit();
};

export const syncTaskOrders = async (columns: Columns, columnIds: string[]) => {
  const updates: Array<{
    taskId: string;
    status: string;
    order: number;
    completedAt?: number | ReturnType<typeof deleteField>;
  }> = [];

  columnIds.forEach((columnId) => {
    const col = columns[columnId];
    if (!col) return;
    col.items.forEach((task, index) => {
      const isDone =
        col.stage === "done" ||
        /done|closed|complete|completed|finish|selesai/i.test(col.name);
      updates.push({
        taskId: task.id,
        status: columnId,
        order: index,
        completedAt: isDone ? task.completedAt ?? Date.now() : deleteField(),
      });
    });
  });

  if (!updates.length) return;

  let batch = writeBatch(db);
  let ops = 0;

  for (const u of updates) {
    batch.update(doc(db, TASK_COLLECTION, u.taskId), {
      status: u.status,
      order: u.order,
      completedAt: u.completedAt,
    });
    ops += 1;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }
};
