import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, getUserLabel } from "../../context/useAuth";
import { useBoards } from "../../context/useBoards";
import {
  getRoleLabel,
  normalizeBoardRole,
  type NormalizedBoardRole,
} from "../../helpers/roles";
import {
  acceptInvite,
  declineInvite,
  hasPendingInvite,
  isMemberEmail,
  removeBoardMember,
  sendInvite,
  subscribeActivity,
  subscribeBoardMembers,
  subscribeInvitesForEmail,
  updateBoardMemberRole,
} from "../../services/collaborationService";
import { subscribeBoardData } from "../../services/taskService";
import { Columns, TaskT } from "../../types";
import type {
  ActivityEntry,
  BoardInvite,
  BoardMember,
  BoardRole,
} from "../../types/collaboration";

const formatDateId = (date: Date) =>
  date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatTimeAgo = (createdAt: number) => {
  const diff = Date.now() - createdAt;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

type TaskRow = TaskT & {
  columnName: string;
};

  const Home = () => {
  const { user, profile } = useAuth();
  const { activeBoardId, activeBoard, boards } = useBoards();
  const boardLink = activeBoard?.projectId ? `/board/${activeBoard.projectId}` : "/projects";
  const [columns, setColumns] = useState<Columns>({});
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [invites, setInvites] = useState<BoardInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const inviteRole: BoardRole = "member";
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState(false);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);
  const isOwner = !!user && !!activeBoard && activeBoard.createdBy === user.uid;
  const canManageMembers = isOwner;
  const visibleMembers = canManageMembers ? members : members.slice(0, 6);

  useEffect(() => {
    if (!activeBoardId) {
      setColumns({});
      setLoading(false);
      return;
    }
    let didSet = false;
    const unsubscribe = subscribeBoardData(
      activeBoardId,
      (data) => {
        setColumns(data);
        if (!didSet) {
          setLoading(false);
          didSet = true;
        }
      },
      (e) => {
        setError(e instanceof Error ? e.message : "Failed to load data.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [activeBoardId]);

  useEffect(() => {
    if (!user) return;
    const unsubscribeInvites = subscribeInvitesForEmail(
      user.email || "",
      setInvites
    );

    if (!activeBoardId) {
      setMembers([]);
      setActivity([]);
      return () => {
        unsubscribeInvites();
      };
    }

    const unsubscribeMembers = subscribeBoardMembers(
      activeBoardId,
      setMembers
    );
    const unsubscribeActivity = subscribeActivity(
      activeBoardId,
      setActivity
    );
    return () => {
      unsubscribeMembers();
      unsubscribeActivity();
      unsubscribeInvites();
    };
  }, [activeBoardId, user]);

  const myWork = useMemo(() => {
    if (!user) return [];
    const tasks: TaskRow[] = [];
    Object.values(columns).forEach((col) => {
      col.items.forEach((task) => {
        tasks.push({ ...task, columnName: col.name });
      });
    });

    return tasks
      .filter(
        (task) =>
          task.assigneeId === user.uid ||
          (task.mentions || []).includes(user.uid)
      )
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) {
          return Date.parse(a.dueDate) - Date.parse(b.dueDate);
        }
        return a.deadline - b.deadline;
      })
      .slice(0, 6);
  }, [columns, user]);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === "pending"),
    [invites]
  );
  const boardNameMap = useMemo(() => {
    const map = new Map<string, string>();
    boards.forEach((board) => map.set(board.id, board.name));
    return map;
  }, [boards]);

  const handleSendInvite = async () => {
    if (!user || !activeBoardId) return;
    if (!canManageMembers) {
      setInviteMessage("Only the owner can invite members.");
      return;
    }
    const trimmed = inviteEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setInviteMessage("Please enter a valid email.");
      return;
    }
    if (user.email && user.email.toLowerCase() === trimmed.toLowerCase()) {
      setInviteMessage("You cannot invite yourself.");
      return;
    }

    setInviteSending(true);
    setInviteMessage(null);
    try {
      const alreadyMember = await isMemberEmail(activeBoardId, trimmed);
      if (alreadyMember) {
        setInviteMessage("That email is already a member.");
        return;
      }

      const alreadyInvited = await hasPendingInvite(activeBoardId, trimmed);
      if (alreadyInvited) {
        setInviteMessage("Invite already sent.");
        return;
      }

      await sendInvite({
        boardId: activeBoardId,
        email: trimmed,
        invitedByUid: user.uid,
        invitedByName: getUserLabel(user, profile),
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteMessage("Invite sent.");
    } catch (e) {
      setInviteMessage(e instanceof Error ? e.message : "Invite failed.");
    } finally {
      setInviteSending(false);
    }
  };

  const handleRoleChange = async (
    member: BoardMember,
    nextRole: NormalizedBoardRole
  ) => {
    if (!canManageMembers || member.uid === user?.uid) return;
    if (normalizeBoardRole(member.role) === nextRole) return;
    setMemberBusyId(member.id);
    setMemberMessage(null);
    try {
      await updateBoardMemberRole(member.id, nextRole);
      setMemberMessage(
        `Updated ${member.displayName} to ${getRoleLabel(nextRole)}.`
      );
    } catch (e) {
      setMemberMessage(
        e instanceof Error ? e.message : "Failed to update member role."
      );
    } finally {
      setMemberBusyId(null);
    }
  };

  const handleRemoveMember = async (member: BoardMember) => {
    if (!canManageMembers || member.uid === user?.uid) return;
    if (!window.confirm(`Remove ${member.displayName} from this board?`)) {
      return;
    }
    setMemberBusyId(member.id);
    setMemberMessage(null);
    try {
      await removeBoardMember(member.id);
      setMemberMessage(`${member.displayName} removed from the board.`);
    } catch (e) {
      setMemberMessage(
        e instanceof Error ? e.message : "Failed to remove member."
      );
    } finally {
      setMemberBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-10">
        <span className="text-lg font-semibold text-gray-200">
          Loading dashboard...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-white rounded-lg p-5 shadow-sm">
        <div className="text-red-600 font-semibold">Failed to load</div>
        <div className="text-sm text-gray-600 mt-1">{error}</div>
        <div className="mt-4">
          <Link
            to="/boards"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-400 text-white font-medium hover:bg-orange-500"
          >
            Go to Boards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-8">
      <div className="w-full bg-white rounded-lg p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex flex-col gap-1">
          <div className="text-xl font-bold text-gray-800">
            Welcome, {getUserLabel(user, profile)}
          </div>
          <div className="text-sm text-gray-600">
            Stay aligned with your team and keep tasks moving.
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Active board: {activeBoard?.name || "Not selected"}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Link
            to="/projects"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-400 text-white font-medium hover:bg-orange-500"
          >
            Open Projects
          </Link>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 bg-slate-100 rounded-md px-3 py-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Invite by email"
                className="bg-transparent outline-none text-sm w-full"
                disabled={!activeBoardId || !canManageMembers}
              />
              <button
                type="button"
                onClick={handleSendInvite}
                disabled={inviteSending || !activeBoardId || !canManageMembers}
                className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-60"
              >
                Invite
              </button>
            </div>
            {activeBoardId && !canManageMembers ? (
              <span className="text-xs text-gray-500">
                Only the owner can invite members.
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {inviteMessage ? (
        <div className="text-sm text-gray-700 bg-white rounded-lg border border-gray-100 px-4 py-3 shadow-sm">
          {inviteMessage}
        </div>
      ) : null}
      {memberMessage ? (
        <div className="text-sm text-gray-700 bg-white rounded-lg border border-gray-100 px-4 py-3 shadow-sm">
          {memberMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="w-full flex items-center justify-center py-10">
          <span className="text-lg font-semibold text-gray-200">
            Loading dashboard...
          </span>
        </div>
      ) : error ? (
        <div className="w-full bg-white rounded-lg p-5 shadow-sm">
          <div className="text-red-600 font-semibold">Failed to load</div>
          <div className="text-sm text-gray-600 mt-1">{error}</div>
          <div className="mt-4">
            <Link
              to="/boards"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-400 text-white font-medium hover:bg-orange-500"
            >
              Go to Boards
            </Link>
          </div>
        </div>
      ) : !activeBoardId ? (
        <div className="w-full bg-white rounded-lg p-5 shadow-sm border border-gray-100">
          <div className="text-lg font-bold text-gray-800">
            Create your first board
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Boards help your team organize tasks, deadlines, and collaboration.
          </div>
          <Link
            to="/projects"
            className="inline-flex items-center justify-center mt-4 px-4 py-2 rounded-md bg-orange-400 text-white font-medium hover:bg-orange-500"
          >
            Go to Projects
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 grid-cols-1 gap-4">
          <div className="md:col-span-2 flex flex-col gap-4">
            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-gray-800">
                  My work
                </div>
                <Link
                  to={boardLink}
                  className="text-sm font-semibold text-orange-500 hover:text-orange-600"
                >
                  View board
                </Link>
              </div>
              <div className="text-sm text-gray-600">
                Tasks assigned to you or mentioning you.
              </div>
              {myWork.length === 0 ? (
                <div className="mt-4 text-sm text-gray-600">
                  Nothing assigned yet.
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  {myWork.map((task) => (
                    <div
                      key={task.id}
                      className="w-full flex flex-col md:flex-row md:items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 gap-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-800">
                          {task.title}
                        </span>
                        <span className="text-xs text-gray-600">
                          {task.columnName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {task.dueDate ? (
                          <span className="text-xs font-semibold text-gray-600">
                            Due {formatDateId(new Date(task.dueDate))}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {task.deadline} mins
                          </span>
                        )}
                        {(task.mentions || []).includes(user?.uid || "") ? (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                            Mentioned
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-gray-800">
                  Pending invites
                </div>
                <div className="text-sm text-gray-500">
                  {pendingInvites.length} pending
                </div>
              </div>
              {pendingInvites.length === 0 ? (
                <div className="mt-4 text-sm text-gray-600">
                  No invites waiting.
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-800">
                          {invite.invitedByName}
                        </span>
                        <span className="text-xs text-gray-600">
                          Invited you to{" "}
                          {boardNameMap.get(invite.boardId) || "a board"} as{" "}
                          {getRoleLabel(invite.role)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => user && acceptInvite(invite, user)}
                          className="px-3 py-1.5 rounded-md bg-orange-400 text-white text-sm font-semibold hover:bg-orange-500"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => declineInvite(invite.id)}
                          className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
              <div className="text-lg font-bold text-gray-800">Team</div>
              <div className="text-sm text-gray-600">
                {members.length} members in this board.
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {visibleMembers.map((member) => {
                  const roleValue = normalizeBoardRole(member.role);
                  const isSelf = member.uid === user?.uid;
                  const isBusy = memberBusyId === member.id;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-sm grid place-items-center">
                          {member.displayName
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((p) => p[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-800">
                            {member.displayName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {member.email}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManageMembers && !isSelf ? (
                          <>
                            <select
                              value={roleValue}
                              onChange={(e) =>
                                handleRoleChange(
                                  member,
                                  e.target.value as NormalizedBoardRole
                                )
                              }
                              disabled={isBusy}
                              className="text-xs bg-slate-100 border border-slate-200 rounded px-2 py-1"
                            >
                              <option value="member">Member</option>
                              {roleValue === "admin" ? (
                                <option value="admin" disabled>
                                  Admin (legacy)
                                </option>
                              ) : null}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member)}
                              disabled={isBusy}
                              className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded hover:bg-red-100 disabled:opacity-60"
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-gray-600">
                            {getRoleLabel(member.role)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {members.length === 0 ? (
                  <div className="text-sm text-gray-500">No members yet.</div>
                ) : null}
              </div>
            </div>

            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
              <div className="text-lg font-bold text-gray-800">
                Activity feed
              </div>
              <div className="text-sm text-gray-600">
                Latest updates from your team.
              </div>
              {activity.length === 0 ? (
                <div className="mt-4 text-sm text-gray-600">
                  No activity yet.
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-3">
                  {activity.slice(0, 6).map((entry) => (
                    <div key={entry.id} className="flex flex-col gap-1">
                      <div className="text-sm text-gray-800">
                        <span className="font-semibold">{entry.actorName}</span>{" "}
                        {entry.message}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTimeAgo(entry.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
