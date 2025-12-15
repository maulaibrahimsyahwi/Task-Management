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

// Fungsi inisialisasi default columns jika kosong
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
  // 1. Ambil Data Kolom (Columns)
  const colRef = collection(db, COLUMN_COLLECTION);
  const qCol = query(colRef, orderBy("createdAt", "asc"));
  const colSnap = await getDocs(qCol);

  // Jika kolom kosong, buat default dulu lalu refresh
  if (colSnap.empty) {
    await initializeDefaultColumns();
    return getBoardData(); // Rekursif panggil ulang setelah create
  }

  // 2. Siapkan struktur Board kosong berdasarkan kolom yang ada
  const board: Columns = {};
  const validColumnIds: string[] = [];

  colSnap.forEach((doc) => {
    // PERBAIKAN: Gunakan tipe ColumnData di sini agar variabelnya terpakai
    const colData = doc.data() as ColumnData;

    board[doc.id] = {
      name: colData.name,
      items: [],
    };
    validColumnIds.push(doc.id);
  });

  // 3. Ambil Data Tasks
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

    // Pastikan task masuk ke kolom yang valid (jika kolom dihapus, masuk ke kolom pertama/default)
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

// Fungsi Tambah Kolom Baru
export const addColumn = async (name: string) => {
  const docRef = await addDoc(collection(db, COLUMN_COLLECTION), {
    name,
    createdAt: Date.now(),
  });
  return { id: docRef.id, name };
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

export const updateTaskStatus = async (taskId: string, newStatus: string) => {
  const taskRef = doc(db, TASK_COLLECTION, taskId);
  await updateDoc(taskRef, { status: newStatus });
};

export const deleteTask = async (taskId: string) => {
  const taskRef = doc(db, TASK_COLLECTION, taskId);
  await deleteDoc(taskRef);
};
