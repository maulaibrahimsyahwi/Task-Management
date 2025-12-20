export type TimeLog = {
  id: string;
  boardId: string;
  taskId: string;
  userId: string;
  userName: string;
  minutes: number;
  note?: string;
  createdAt: number;
};
