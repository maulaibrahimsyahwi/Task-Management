import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { AutomationRule } from "../types/automation";

const AUTOMATION_COLLECTION = "automations";

export const createAutomationRule = async (params: {
  boardId: string;
  name: string;
  trigger: AutomationRule["trigger"];
  columnId?: string;
  actionType: AutomationRule["actionType"];
  actionValue: AutomationRule["actionValue"];
  createdBy: string;
}) => {
  const payload = {
    boardId: params.boardId,
    name: params.name.trim() || "Automation",
    enabled: true,
    trigger: params.trigger,
    columnId: params.columnId || "",
    actionType: params.actionType,
    actionValue: params.actionValue,
    createdAt: Date.now(),
    createdBy: params.createdBy,
  };
  const docRef = await addDoc(collection(db, AUTOMATION_COLLECTION), payload);
  return { id: docRef.id, ...payload } as AutomationRule;
};

export const updateAutomationRule = async (
  ruleId: string,
  updates: Partial<{
    name: string;
    enabled: boolean;
    trigger: AutomationRule["trigger"];
    columnId: string;
    actionType: AutomationRule["actionType"];
    actionValue: AutomationRule["actionValue"];
  }>
) => {
  const payload: Record<string, unknown> = {};
  if (typeof updates.name === "string") payload.name = updates.name.trim();
  if (typeof updates.enabled === "boolean") payload.enabled = updates.enabled;
  if (updates.trigger) payload.trigger = updates.trigger;
  if (updates.columnId !== undefined) payload.columnId = updates.columnId;
  if (updates.actionType) payload.actionType = updates.actionType;
  if (updates.actionValue !== undefined) payload.actionValue = updates.actionValue;
  if (Object.keys(payload).length === 0) return;
  await updateDoc(doc(db, AUTOMATION_COLLECTION, ruleId), payload);
};

export const deleteAutomationRule = async (ruleId: string) => {
  await deleteDoc(doc(db, AUTOMATION_COLLECTION, ruleId));
};

export const subscribeAutomationRules = (
  boardId: string,
  onChange: (rules: AutomationRule[]) => void
) => {
  const q = query(
    collection(db, AUTOMATION_COLLECTION),
    where("boardId", "==", boardId)
  );
  return onSnapshot(q, (snapshot) => {
    const rules = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<AutomationRule, "id">),
    }));
    rules.sort((a, b) => b.createdAt - a.createdAt);
    onChange(rules);
  });
};
