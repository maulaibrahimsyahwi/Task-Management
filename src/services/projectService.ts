import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Project } from "../types/collaboration";

const PROJECTS_COLLECTION = "projects";

const sortProjects = (projects: Project[]) =>
  projects.sort((a, b) => {
    const aKey = a.updatedAt ?? a.createdAt ?? 0;
    const bKey = b.updatedAt ?? b.createdAt ?? 0;
    if (aKey !== bKey) return bKey - aKey;
    return a.name.localeCompare(b.name);
  });

export const createProject = async (params: {
  name: string;
  description?: string;
  createdBy: string;
}) => {
  const createdAt = Date.now();
  const payload = {
    name: params.name.trim() || "Untitled project",
    description: params.description?.trim() || "",
    createdAt,
    updatedAt: createdAt,
    createdBy: params.createdBy,
  };
  const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), payload);
  return { id: docRef.id, ...payload } as Project;
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
  await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
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
