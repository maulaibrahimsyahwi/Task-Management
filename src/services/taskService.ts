import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { Columns, TaskT, ColumnData } from "../types";

const TASK_COLLECTION = "tasks";
const COLUMN_COLLECTION = "columns";

const initializeDefaultColumns = async () => {
  const defaults = ["To Do", "Doing", "Done"];
  for (const name of defaults) {
    await addDoc(collection(db, COLUMN_COLLECTION), {
      name,
      createdAt: Date.now(),
    });
  }
};

export const getBoardData = async (): Promise<Columns> => {
  const colRef = collection(db, COLUMN_COLLECTION);
  const qCol = query(colRef, orderBy("createdAt", "asc"));
  const colSnap = await getDocs(qCol);

  if (colSnap.empty) {
    await initializeDefaultColumns();
    return getBoardData();
  }

  const board: Columns = {};
  const validColumnIds: string[] = [];

  colSnap.forEach((doc) => {
    const colData = doc.data() as ColumnData;

    board[doc.id] = {
      name: colData.name,
      items: [],
    };
    validColumnIds.push(doc.id);
  });

  const taskSnap = await getDocs(collection(db, TASK_COLLECTION));

  taskSnap.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    const task: TaskT = {
      id: docSnapshot.id,
      title: data.title,
      description: data.description,
      priority: data.priority,
      deadline: data.deadline,
      image: data.image,
      alt: data.alt,
      tags: data.tags || [],
    };

    let status = data.status;
    if (!status || !board[status]) {
      status = validColumnIds[0];
    }

    if (board[status]) {
      board[status].items.push(task);
    }
  });

  return board;
};

export const addColumn = async (name: string) => {
  const docRef = await addDoc(collection(db, COLUMN_COLLECTION), {
    name,
    createdAt: Date.now(),
  });
  return { id: docRef.id, name };
};

export const deleteColumn = async (columnId: string) => {
  const colRef = doc(db, COLUMN_COLLECTION, columnId);
  await deleteDoc(colRef);
};

export const addTask = async (task: TaskT, status: string) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...taskData } = task;
  const docRef = await addDoc(collection(db, TASK_COLLECTION), {
    ...taskData,
    status,
  });
  return { id: docRef.id, ...taskData };
};

export const updateTask = async (task: TaskT) => {
  const { id, ...taskData } = task;
  const taskRef = doc(db, TASK_COLLECTION, id);
  await updateDoc(taskRef, { ...taskData });
};

export const updateTaskStatus = async (taskId: string, newStatus: string) => {
  const taskRef = doc(db, TASK_COLLECTION, taskId);
  await updateDoc(taskRef, { status: newStatus });
};

export const deleteTask = async (taskId: string) => {
  const taskRef = doc(db, TASK_COLLECTION, taskId);
  await deleteDoc(taskRef);
};
