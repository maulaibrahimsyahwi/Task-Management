import {
  collection,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import type { Board } from "../types/collaboration";
import { db, auth } from "../firebase";

const BOARDS_COLLECTION = "boards";

const chunkArray = <T>(arr: T[], size: number) => {
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

const getAuthToken = async () => {
  if (!auth.currentUser) throw new Error("User not authenticated");
  return await auth.currentUser.getIdToken();
};

export const createBoard = async (params: {
  name: string;
  description?: string;
  createdBy: string;
  projectId: string;
}) => {
  const token = await getAuthToken();

  const response = await fetch("/api/board", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to create board");
  }

  return await response.json();
};

export const updateBoard = async (
  boardId: string,
  updates: { name?: string; description?: string }
) => {
  const token = await getAuthToken();

  const response = await fetch("/api/board", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id: boardId, ...updates }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update board");
  }
};

export const deleteBoard = async (boardId: string) => {
  const token = await getAuthToken();

  const response = await fetch(`/api/board?id=${boardId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to delete board");
  }
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
