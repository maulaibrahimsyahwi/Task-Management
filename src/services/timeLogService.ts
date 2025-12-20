import {
  addDoc,
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { TimeLog } from "../types/time";

const TIMELOGS_COLLECTION = "timeLogs";
const TASKS_COLLECTION = "tasks";

export const addTimeLog = async (params: {
  boardId: string;
  taskId: string;
  userId: string;
  userName: string;
  minutes: number;
  note?: string;
}) => {
  await addDoc(collection(db, TIMELOGS_COLLECTION), {
    boardId: params.boardId,
    taskId: params.taskId,
    userId: params.userId,
    userName: params.userName,
    minutes: params.minutes,
    note: params.note?.trim() || "",
    createdAt: Date.now(),
  });

  await updateDoc(doc(db, TASKS_COLLECTION, params.taskId), {
    timeLoggedMins: increment(params.minutes),
  });
};

export const subscribeTimeLogs = (
  boardId: string,
  taskId: string,
  onChange: (logs: TimeLog[]) => void
) => {
  const q = query(
    collection(db, TIMELOGS_COLLECTION),
    where("boardId", "==", boardId),
    where("taskId", "==", taskId)
  );
  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<TimeLog, "id">),
    }));
    logs.sort((a, b) => b.createdAt - a.createdAt);
    onChange(logs);
  });
};
