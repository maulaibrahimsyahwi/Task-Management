export type BoardFilters = {
  assignee: string;
  priority: string;
  tag: string;
  due: string;
  sprint: string;
};

export type SwimlaneMode = "none" | "assignee" | "priority";

export const DEFAULT_BOARD_FILTERS: BoardFilters = {
  assignee: "all",
  priority: "all",
  tag: "all",
  due: "all",
  sprint: "all",
};

export type ColumnStageDraft = "backlog" | "todo" | "in_progress" | "done" | "";

export type ColumnEditState = {
  columnId: string | null;
  name: string;
  wipLimit: string;
  stage: ColumnStageDraft;
};

