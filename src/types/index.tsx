export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type Attachment = {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
  createdAt: number;
  createdBy: string;
};

export type TaskT = {
  id: string;
  title: string;
  description: string;
  priority: string;
  deadline: number;
  dueDate?: string;
  assigneeId?: string;
  mentions?: string[];
  sprintId?: string;
  boardId?: string;
  image?: string;
  alt?: string;
  tags: { title: string; bg: string; text: string }[];
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
  timeLoggedMins?: number;
  order?: number;
  createdAt?: number;
  completedAt?: number;
};

export type Column = {
  name: string;
  items: TaskT[];
  wipLimit?: number;
  stage?: "backlog" | "todo" | "in_progress" | "done";
};

export type Columns = {
  [key: string]: Column;
};

export type ColumnData = {
  id: string;
  name: string;
  createdAt: number;
  boardId?: string;
  wipLimit?: number;
  stage?: "backlog" | "todo" | "in_progress" | "done";
};
