import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Sprint, SprintStatus } from "../types/sprints";

const SPRINTS_COLLECTION = "sprints";
const TASKS_COLLECTION = "tasks";

const normalizeStatus = (status?: SprintStatus) => {
  if (status === "active" || status === "completed") return status;
  return "planned";
};

const sortSprints = (sprints: Sprint[]) => {
  const order: Record<SprintStatus, number> = {
    active: 0,
    planned: 1,
    completed: 2,
  };
  return sprints.sort((a, b) => {
    const statusDiff = order[a.status] - order[b.status];
    if (statusDiff !== 0) return statusDiff;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
};

export const createSprint = async (params: {
  boardId: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  createdBy: string;
}) => {
  const createdAt = Date.now();
  const payload = {
    boardId: params.boardId,
    name: params.name.trim() || "Sprint",
    goal: params.goal?.trim() || "",
    startDate: params.startDate || "",
    endDate: params.endDate || "",
    status: "planned" as SprintStatus,
    createdAt,
    updatedAt: createdAt,
    createdBy: params.createdBy,
  };
  const docRef = await addDoc(collection(db, SPRINTS_COLLECTION), payload);
  return { id: docRef.id, ...payload } as Sprint;
};

export const updateSprint = async (
  sprintId: string,
  updates: Partial<{
    name: string;
    goal: string;
    startDate: string;
    endDate: string;
    status: SprintStatus;
  }>
) => {
  const payload: Record<string, unknown> = {
    updatedAt: Date.now(),
  };
  if (typeof updates.name === "string") {
    payload.name = updates.name.trim();
  }
  if (typeof updates.goal === "string") {
    payload.goal = updates.goal.trim();
  }
  if (typeof updates.startDate === "string") {
    payload.startDate = updates.startDate;
  }
  if (typeof updates.endDate === "string") {
    payload.endDate = updates.endDate;
  }
  if (updates.status) {
    payload.status = normalizeStatus(updates.status);
  }
  await updateDoc(doc(db, SPRINTS_COLLECTION, sprintId), payload);
};

export const setSprintStatus = async (
  boardId: string,
  sprintId: string,
  nextStatus: SprintStatus
) => {
  const batch = writeBatch(db);
  if (nextStatus === "active") {
    const activeSnap = await getDocs(
      query(
        collection(db, SPRINTS_COLLECTION),
        where("boardId", "==", boardId),
        where("status", "==", "active")
      )
    );
    activeSnap.forEach((docSnap) => {
      if (docSnap.id === sprintId) return;
      batch.update(docSnap.ref, { status: "completed", updatedAt: Date.now() });
    });
  }
  batch.update(doc(db, SPRINTS_COLLECTION, sprintId), {
    status: nextStatus,
    updatedAt: Date.now(),
  });
  await batch.commit();
};

export const deleteSprint = async (sprintId: string) => {
  const taskSnap = await getDocs(
    query(collection(db, TASKS_COLLECTION), where("sprintId", "==", sprintId))
  );
  if (!taskSnap.empty) {
    const batch = writeBatch(db);
    taskSnap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { sprintId: deleteField() });
    });
    await batch.commit();
  }
  await deleteDoc(doc(db, SPRINTS_COLLECTION, sprintId));
};

export const subscribeSprints = (
  boardId: string,
  onChange: (sprints: Sprint[]) => void
) => {
  const q = query(
    collection(db, SPRINTS_COLLECTION),
    where("boardId", "==", boardId)
  );
  return onSnapshot(q, (snapshot) => {
    const sprints = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Sprint, "id">),
    }));
    onChange(sortSprints(sprints));
  });
};
