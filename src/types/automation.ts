export type AutomationTrigger = "task:create" | "task:move";
export type AutomationActionType =
  | "assign"
  | "set_due_in_days"
  | "set_priority";

export type AutomationRule = {
  id: string;
  boardId: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  columnId?: string;
  actionType: AutomationActionType;
  actionValue: string | number;
  createdAt: number;
  createdBy: string;
};
