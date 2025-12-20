import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth, getUserLabel } from "./useAuth";
import { BoardContext, type BoardContextValue } from "./boardContextStore";
import type { Board, BoardMember } from "../types/collaboration";
import {
  DEFAULT_BOARD_ID,
  ensureBoardMember,
  logActivity,
  subscribeBoardMemberships,
} from "../services/collaborationService";
import {
  createBoard as createBoardDoc,
  deleteBoard as deleteBoardDoc,
  subscribeBoardsByIds,
  updateBoard as updateBoardDoc,
} from "../services/boardService";
import { createDefaultColumns } from "../services/taskService";

const ACTIVE_BOARD_STORAGE_KEY = "rtm_active_board_v1";

export const BoardProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [memberships, setMemberships] = useState<BoardMember[]>([]);
  const [activeBoardId, setActiveBoardIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBoards([]);
      setMemberships([]);
      setActiveBoardIdState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeBoardMemberships(user.uid, (next) => {
      setMemberships(next);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const boardIds = memberships.map((m) => m.boardId);
    const unsubscribe = subscribeBoardsByIds(boardIds, setBoards);
    return () => unsubscribe();
  }, [memberships, user]);

  useEffect(() => {
    if (!boards.length) return;
    const preferredId = profile?.defaultBoardId;
    const hasPreferred =
      preferredId && boards.some((b) => b.id === preferredId);
    if (
      hasPreferred &&
      (!activeBoardId ||
        activeBoardId === DEFAULT_BOARD_ID ||
        !boards.some((b) => b.id === activeBoardId))
    ) {
      setActiveBoardIdState(preferredId);
      return;
    }
    if (!activeBoardId || !boards.some((b) => b.id === activeBoardId)) {
      setActiveBoardIdState(boards[0].id);
    }
  }, [activeBoardId, boards, profile?.defaultBoardId]);

  useEffect(() => {
    if (!user || loading) return;
    if (memberships.length === 0) {
      setActiveBoardIdState(null);
      try {
        localStorage.removeItem(ACTIVE_BOARD_STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }
    if (
      activeBoardId &&
      !memberships.some((member) => member.boardId === activeBoardId)
    ) {
      setActiveBoardIdState(memberships[0].boardId);
    }
  }, [activeBoardId, loading, memberships, user]);

  const setActiveBoardId = useCallback((boardId: string) => {
    setActiveBoardIdState(boardId);
    try {
      localStorage.setItem(ACTIVE_BOARD_STORAGE_KEY, boardId);
    } catch {
      // ignore
    }
  }, []);

  const createBoard = useCallback(
    async (params: { name: string; description?: string }) => {
      if (!user) return;
      const board = await createBoardDoc({
        name: params.name,
        description: params.description,
        createdBy: user.uid,
      });
      await ensureBoardMember(board.id, user, "admin");
      await createDefaultColumns(board.id);
      await logActivity({
        boardId: board.id,
        actorUid: user.uid,
        actorName: getUserLabel(user, profile),
        message: `created board "${board.name}"`,
        type: "board:create",
      });
      setActiveBoardId(board.id);
    },
    [profile, setActiveBoardId, user]
  );

  const updateBoard = useCallback(
    async (boardId: string, updates: { name?: string; description?: string }) => {
      await updateBoardDoc(boardId, updates);
      if (user) {
        await logActivity({
          boardId,
          actorUid: user.uid,
          actorName: getUserLabel(user, profile),
          message: "updated board settings",
          type: "board:update",
        });
      }
    },
    [profile, user]
  );

  const deleteBoard = useCallback(
    async (boardId: string) => {
      await deleteBoardDoc(boardId);
      if (activeBoardId === boardId) {
        setActiveBoardIdState(null);
      }
    },
    [activeBoardId]
  );

  const activeBoard = useMemo(
    () => boards.find((b) => b.id === activeBoardId) || null,
    [activeBoardId, boards]
  );

  const value = useMemo<BoardContextValue>(
    () => ({
      boards,
      memberships,
      activeBoardId,
      activeBoard,
      setActiveBoardId,
      createBoard,
      updateBoard,
      deleteBoard,
      loading,
    }),
    [
      activeBoard,
      activeBoardId,
      boards,
      createBoard,
      deleteBoard,
      loading,
      memberships,
      setActiveBoardId,
      updateBoard,
    ]
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
};
