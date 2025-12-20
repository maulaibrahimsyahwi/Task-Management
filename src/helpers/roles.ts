import type { BoardRole } from "../types/collaboration";

export type NormalizedBoardRole = "admin" | "member";

export const normalizeBoardRole = (role: BoardRole): NormalizedBoardRole =>
  role === "owner" ? "admin" : role;

export const isAdminRole = (role: BoardRole) =>
  normalizeBoardRole(role) === "admin";

export const getRoleLabel = (role: BoardRole) =>
  normalizeBoardRole(role) === "admin" ? "Admin" : "Member";
