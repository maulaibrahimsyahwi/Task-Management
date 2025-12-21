import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  documentId,
  setDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Project } from "../types/collaboration";
import { deleteBoard as deleteBoardDoc } from "./boardService";

const PROJECTS_COLLECTION = "projects";
const BOARDS_COLLECTION = "boards";
const COLUMNS_COLLECTION = "columns";
const MEMBERS_COLLECTION = "boardMembers";

const sortProjects = (projects: Project[]) =>
  projects.sort((a, b) => {
    const aKey = a.updatedAt ?? a.createdAt ?? 0;
    const bKey = b.updatedAt ?? b.createdAt ?? 0;
    if (aKey !== bKey) return bKey - aKey;
    return a.name.localeCompare(b.name);
  });

const chunkArray = <T,>(arr: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export const createProject = async (params: {
  name: string;
  description?: string;
  createdBy: string;
}) => {
  const createdAt = Date.now();

  // 1. Create Project Reference
  const projectRef = doc(collection(db, PROJECTS_COLLECTION));
  // 2. Create Board Reference
  const boardRef = doc(collection(db, BOARDS_COLLECTION));

  // 3. Set Project Data (write project first so board rules can validate ownership)
  const projectPayload = {
    name: params.name.trim() || "Untitled project",
    description: params.description?.trim() || "",
    createdAt,
    updatedAt: createdAt,
    createdBy: params.createdBy,
    defaultBoardId: boardRef.id,
  };
  await setDoc(projectRef, projectPayload);

  // 4. Set Board Data
  const boardPayload = {
    name: "Main Board",
    description: "Default board for this project",
    createdAt,
    updatedAt: createdAt,
    createdBy: params.createdBy,
    projectId: projectRef.id,
  };
  await setDoc(boardRef, boardPayload);

  // 5. Add Owner as Board Member
  const memberId = `${boardRef.id}_${params.createdBy}`;
  const memberRef = doc(db, MEMBERS_COLLECTION, memberId);
  await setDoc(memberRef, {
    boardId: boardRef.id,
    role: "owner",
    uid: params.createdBy,
    displayName: "",
    email: "",
    joinedAt: createdAt,
  });

  // 6. Create Default Columns
  const defaultColumns = [
    { name: "To Do", stage: "todo", order: 0 },
    { name: "In Progress", stage: "in_progress", order: 1 },
    { name: "Done", stage: "done", order: 2 },
  ];

  const batch = writeBatch(db);
  defaultColumns.forEach((col) => {
    const colRef = doc(collection(db, COLUMNS_COLLECTION));
    batch.set(colRef, {
      name: col.name,
      stage: col.stage,
      boardId: boardRef.id,
      createdAt: createdAt + col.order,
      order: col.order,
    });
  });

  await batch.commit();

  return {
    id: projectRef.id,
    boardId: boardRef.id,
    ...projectPayload,
  };
};

export const getProjectById = async (projectId: string) => {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const snapshot = await getDoc(projectRef);
  if (!snapshot.exists()) return null;
  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<Project, "id">),
  } as Project;
};

export const updateProject = async (
  projectId: string,
  updates: { name?: string; description?: string }
) => {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  await updateDoc(projectRef, {
    ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
    ...(updates.description !== undefined
      ? { description: updates.description.trim() }
      : {}),
    updatedAt: Date.now(),
  });
};

export const deleteProject = async (projectId: string) => {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const snapshot = await getDoc(projectRef);
  if (!snapshot.exists()) return;

  const data = snapshot.data() as Partial<Project>;
  const boardIds = new Set<string>();

  if (typeof data.defaultBoardId === "string" && data.defaultBoardId.trim()) {
    boardIds.add(data.defaultBoardId.trim());
  }

  let boardsSnap;
  try {
    boardsSnap = await getDocs(
      query(
        collection(db, BOARDS_COLLECTION),
        where("projectId", "==", projectId)
      )
    );
  } catch (e) {
    if (e && typeof e === "object" && "code" in e) {
      const code = String((e as { code?: unknown }).code ?? "");
      if (code === "permission-denied") {
        boardsSnap = null;
      } else {
        const message =
          "message" in e ? String((e as { message?: unknown }).message) : "";
        const err = new Error(
          message
            ? `Failed to list project boards (${projectId}): ${message}`
            : `Failed to list project boards (${projectId}).`
        );
        if (code) (err as Error & { code?: string }).code = code;
        throw err;
      }
    } else {
      throw new Error(
        `Failed to list project boards (${projectId}): ${String(e)}`
      );
    }
  }
  boardsSnap?.docs.forEach((docSnap) => {
    boardIds.add(docSnap.id);
  });

  for (const boardId of boardIds) {
    try {
      await deleteBoardDoc(boardId);
    } catch (e) {
      if (e && typeof e === "object" && "code" in e) {
        const code = String((e as { code?: unknown }).code ?? "");
        const message =
          "message" in e ? String((e as { message?: unknown }).message) : "";
        const err = new Error(
          message
            ? `Failed to delete board (${boardId}) for project (${projectId}): ${message}`
            : `Failed to delete board (${boardId}) for project (${projectId}).`
        );
        if (code) (err as Error & { code?: string }).code = code;
        throw err;
      }
      throw new Error(
        `Failed to delete board (${boardId}) for project (${projectId}): ${String(e)}`
      );
    }
  }

  try {
    await deleteDoc(projectRef);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e) {
      const code = String((e as { code?: unknown }).code ?? "");
      const message =
        "message" in e ? String((e as { message?: unknown }).message) : "";
      const err = new Error(
        message
          ? `Failed to delete project (${projectId}): ${message}`
          : `Failed to delete project (${projectId}).`
      );
      if (code) (err as Error & { code?: string }).code = code;
      throw err;
    }
    throw new Error(`Failed to delete project (${projectId}): ${String(e)}`);
  }
};

export const setProjectDefaultBoard = async (
  projectId: string,
  boardId: string
) => {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const snapshot = await getDoc(projectRef);
  if (!snapshot.exists()) return;
  await updateDoc(projectRef, {
    defaultBoardId: boardId,
    updatedAt: Date.now(),
  });
};

export const subscribeProjectsByOwner = (
  uid: string,
  onChange: (projects: Project[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, PROJECTS_COLLECTION),
    where("createdBy", "==", uid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const projects = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Project, "id">),
      }));
      onChange(sortProjects(projects));
    },
    (error) => {
      onError?.(error);
    }
  );
};

export const subscribeProjectsByIds = (
  projectIds: string[],
  onChange: (projects: Project[]) => void,
  onError?: (error: Error) => void
) => {
  const ids = Array.from(new Set(projectIds.filter(Boolean)));
  if (ids.length === 0) {
    onChange([]);
    return () => {};
  }

  const chunks = chunkArray(ids, 10);
  const projectMap = new Map<string, Project>();

  const unsubscribes = chunks.map((chunk) => {
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      where(documentId(), "in", chunk)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "removed") {
            projectMap.delete(change.doc.id);
            return;
          }
          projectMap.set(change.doc.id, {
            id: change.doc.id,
            ...(change.doc.data() as Omit<Project, "id">),
          });
        });
        onChange(sortProjects(Array.from(projectMap.values())));
      },
      (error) => onError?.(error)
    );
  });

  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
};
