export type BoardRole = "owner" | "admin" | "member";

export type Project = {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  createdBy: string;
  updatedAt?: number;
  defaultBoardId?: string;
};

export type Board = {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  createdBy: string;
  updatedAt?: number;
  projectId?: string;
};

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: number;
  lastActiveAt?: number;
  defaultBoardId?: string;
  defaultProjectId?: string;
};

export type BoardMember = {
  id: string;
  boardId: string;
  uid: string;
  role: BoardRole;
  displayName: string;
  email: string;
  joinedAt: number;
};

export type InviteStatus = "pending" | "accepted" | "declined";

export type BoardInvite = {
  id: string;
  boardId: string;
  email: string;
  role: BoardRole;
  invitedByUid: string;
  invitedByName: string;
  status: InviteStatus;
  createdAt: number;
  respondedAt?: number;
};

export type ActivityEntry = {
  id: string;
  boardId: string;
  message: string;
  createdAt: number;
  actorUid: string;
  actorName: string;
  type?: string;
  taskId?: string;
  columnId?: string;
};

export type TaskComment = {
  id: string;
  boardId: string;
  taskId: string;
  message: string;
  createdAt: number;
  authorUid: string;
  authorName: string;
};
