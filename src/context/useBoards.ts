import { useContext } from "react";
import { BoardContext } from "./boardContextStore";
import type { BoardMember } from "../types/collaboration";
import {
  normalizeBoardRole,
  type NormalizedBoardRole,
} from "../helpers/roles";

export const useBoards = () => {
  const ctx = useContext(BoardContext);
  if (!ctx) {
    throw new Error("useBoards must be used within BoardProvider");
  }
  return ctx;
};

export const getBoardRole = (
  boardId: string,
  memberships: BoardMember[]
): NormalizedBoardRole => {
  const role =
    memberships.find((member) => member.boardId === boardId)?.role ||
    "member";
  return normalizeBoardRole(role);
};
