import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { TaskComment } from "../types/collaboration";

const COMMENTS_COLLECTION = "taskComments";

export const addTaskComment = async (params: {
  boardId: string;
  taskId: string;
  message: string;
  authorUid: string;
  authorName: string;
}) => {
  await addDoc(collection(db, COMMENTS_COLLECTION), {
    boardId: params.boardId,
    taskId: params.taskId,
    message: params.message.trim(),
    authorUid: params.authorUid,
    authorName: params.authorName,
    createdAt: Date.now(),
  });
};

export const subscribeTaskComments = (
  boardId: string,
  taskId: string,
  onChange: (comments: TaskComment[]) => void
) => {
  const q = query(
    collection(db, COMMENTS_COLLECTION),
    where("boardId", "==", boardId),
    where("taskId", "==", taskId)
  );

  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<TaskComment, "id">),
    }));
    comments.sort((a, b) => a.createdAt - b.createdAt);
    onChange(comments);
  });
};

