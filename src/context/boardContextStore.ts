import { createContext } from "react";
import type { Board, BoardMember } from "../types/collaboration";

export type BoardContextValue = {
  boards: Board[];
  memberships: BoardMember[];
  activeBoardId: string | null;
  activeBoard: Board | null;
  setActiveBoardId: (boardId: string) => void;
  createBoard: (params: { name: string; description?: string }) => Promise<void>;
  updateBoard: (
    boardId: string,
    updates: { name?: string; description?: string }
  ) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;
  loading: boolean;
};

export const BoardContext = createContext<BoardContextValue | undefined>(
  undefined
);

