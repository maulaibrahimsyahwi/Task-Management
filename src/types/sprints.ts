export type SprintStatus = "planned" | "active" | "completed";

export type Sprint = {
  id: string;
  boardId: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  status: SprintStatus;
  createdAt: number;
  updatedAt?: number;
  createdBy: string;
};
