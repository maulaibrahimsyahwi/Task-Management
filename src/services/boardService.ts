import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { Board } from "../types/collaboration";

const BOARDS_COLLECTION = "boards";
const MEMBERS_COLLECTION = "boardMembers";
const INVITES_COLLECTION = "invites";
const ACTIVITY_COLLECTION = "activity";
const COLUMNS_COLLECTION = "columns";
const TASKS_COLLECTION = "tasks";
const COMMENTS_COLLECTION = "taskComments";
const SPRINTS_COLLECTION = "sprints";
const TIMELOGS_COLLECTION = "timeLogs";
const AUTOMATIONS_COLLECTION = "automations";

const chunkArray = <T,>(arr: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const sortBoards = (boards: Board[]) =>
  boards.sort((a, b) => {
    const aKey = a.updatedAt ?? a.createdAt ?? 0;
    const bKey = b.updatedAt ?? b.createdAt ?? 0;
    if (aKey !== bKey) return bKey - aKey;
    return a.name.localeCompare(b.name);
  });

const deleteDocsInBatches = async <T>(
  docs: QueryDocumentSnapshot<T, DocumentData>[]
) => {
  const CHUNK = 400;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    docs.slice(i, i + CHUNK).forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  }
};

const deleteByQuery = async (q: ReturnType<typeof query>) => {
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;
  await deleteDocsInBatches(snapshot.docs);
};

export const createBoard = async (params: {
  name: string;
  description?: string;
  createdBy: string;
  projectId: string;
}) => {
  const createdAt = Date.now();
  const payload = {
    name: params.name.trim() || "Untitled board",
    description: params.description?.trim() || "",
    createdAt,
    updatedAt: createdAt,
    createdBy: params.createdBy,
    projectId: params.projectId,
  };
  const docRef = await addDoc(collection(db, BOARDS_COLLECTION), payload);
  return { id: docRef.id, ...payload } as Board;
};

export const updateBoard = async (
  boardId: string,
  updates: { name?: string; description?: string }
) => {
  const boardRef = doc(db, BOARDS_COLLECTION, boardId);
  await updateDoc(boardRef, {
    ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
    ...(updates.description !== undefined
      ? { description: updates.description.trim() }
      : {}),
    updatedAt: Date.now(),
  });
};

export const deleteBoard = async (boardId: string) => {
  await deleteByQuery(
    query(collection(db, TASKS_COLLECTION), where("boardId", "==", boardId))
  );
  await deleteByQuery(
    query(collection(db, COLUMNS_COLLECTION), where("boardId", "==", boardId))
  );
  await deleteByQuery(
    query(collection(db, MEMBERS_COLLECTION), where("boardId", "==", boardId))
  );
  await deleteByQuery(
    query(collection(db, INVITES_COLLECTION), where("boardId", "==", boardId))
  );
  await deleteByQuery(
    query(collection(db, ACTIVITY_COLLECTION), where("boardId", "==", boardId))
  );
  await deleteByQuery(
    query(collection(db, COMMENTS_COLLECTION), where("boardId", "==", boardId))
  );
  await deleteByQuery(
    query(collection(db, AUTOMATIONS_COLLECTION), where("boardId", "==", boardId))
  );
  await deleteByQuery(
    query(collection(db, TIMELOGS_COLLECTION), where("boardId", "==", boardId))
  );
  await deleteByQuery(
    query(collection(db, SPRINTS_COLLECTION), where("boardId", "==", boardId))
  );
  await deleteDoc(doc(db, BOARDS_COLLECTION, boardId));
};

export const subscribeBoardsByIds = (
  boardIds: string[],
  onChange: (boards: Board[]) => void
) => {
  if (boardIds.length === 0) {
    onChange([]);
    return () => {};
  }

  const chunks = chunkArray(boardIds, 10);
  const boardMap = new Map<string, Board>();

  const unsubscribes = chunks.map((chunk) => {
    const q = query(
      collection(db, BOARDS_COLLECTION),
      where(documentId(), "in", chunk)
    );
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data() as Omit<Board, "id">;
        if (change.type === "removed") {
          boardMap.delete(change.doc.id);
          return;
        }
        boardMap.set(change.doc.id, { id: change.doc.id, ...data });
      });
      onChange(sortBoards(Array.from(boardMap.values())));
    });
  });

  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
};

export const getBoardByProjectId = async (projectId: string) => {
  const q = query(
    collection(db, BOARDS_COLLECTION),
    where("projectId", "==", projectId),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  const data = docSnap.data() as Omit<Board, "id">;
  return { id: docSnap.id, ...data } as Board;
};
