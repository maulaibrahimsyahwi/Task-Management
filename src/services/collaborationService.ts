import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { createBoard } from "./boardService";
import { createProject, setProjectDefaultBoard } from "./projectService";
import { isAdminRole, normalizeBoardRole } from "../helpers/roles";
import type {
  ActivityEntry,
  BoardInvite,
  BoardMember,
  BoardRole,
  UserProfile,
} from "../types/collaboration";

export const DEFAULT_BOARD_ID = "default";

const USERS_COLLECTION = "users";
const BOARDS_COLLECTION = "boards";
const MEMBERS_COLLECTION = "boardMembers";
const INVITES_COLLECTION = "invites";
const ACTIVITY_COLLECTION = "activity";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getDisplayName = (user: User) =>
  user.displayName || user.email?.split("@")[0] || "User";

export const ensureUserProfile = async (user: User) => {
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const snapshot = await getDoc(userRef);
  const baseProfile: UserProfile = {
    uid: user.uid,
    email: user.email || "",
    displayName: getDisplayName(user),
    photoURL: user.photoURL || undefined,
    createdAt: snapshot.exists()
      ? (snapshot.data()?.createdAt as number) || Date.now()
      : Date.now(),
    lastActiveAt: Date.now(),
  };

  await setDoc(userRef, baseProfile, { merge: true });
};

export const subscribeUserProfile = (
  uid: string,
  onChange: (profile: UserProfile | null) => void
) => {
  const userRef = doc(db, USERS_COLLECTION, uid);
  return onSnapshot(userRef, (snapshot) => {
    if (!snapshot.exists()) {
      onChange(null);
      return;
    }
    const data = snapshot.data() as UserProfile;
    onChange(data);
  });
};

export const updateUserActivity = async (uid: string) => {
  const userRef = doc(db, USERS_COLLECTION, uid);
  await setDoc(userRef, { lastActiveAt: Date.now() }, { merge: true });
};

export const ensureDefaultBoard = async (createdBy: string) => {
  const boardRef = doc(db, BOARDS_COLLECTION, DEFAULT_BOARD_ID);
  const snapshot = await getDoc(boardRef);
  if (snapshot.exists()) {
    return { boardId: DEFAULT_BOARD_ID, created: false };
  }
  const createdAt = Date.now();
  await setDoc(boardRef, {
    name: "Team Board",
    description: "Default collaborative board",
    createdAt,
    updatedAt: createdAt,
    createdBy,
  });
  return { boardId: DEFAULT_BOARD_ID, created: true };
};

export const ensurePersonalBoard = async (user: User) => {
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const userSnap = await getDoc(userRef);
  const data = userSnap.exists() ? (userSnap.data() as Partial<UserProfile>) : {};

  let projectId =
    typeof data.defaultProjectId === "string" ? data.defaultProjectId : "";
  if (projectId) {
    const projectRef = doc(db, "projects", projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists() || projectSnap.data()?.createdBy !== user.uid) {
      projectId = "";
    }
  }

  if (!projectId) {
    const project = await createProject({
      name: "My Project",
      description: "Your personal workspace",
      createdBy: user.uid,
    });
    projectId = project.id;
    await setDoc(userRef, { defaultProjectId: projectId }, { merge: true });
  }

  let boardId =
    typeof data.defaultBoardId === "string" ? data.defaultBoardId : "";

  if (boardId) {
    const memberRef = doc(db, MEMBERS_COLLECTION, `${boardId}_${user.uid}`);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      const existingRole = (memberSnap.data() as BoardMember).role;
      await ensureBoardMember(boardId, user, existingRole);
      if (data.defaultBoardId !== boardId) {
        await setDoc(userRef, { defaultBoardId: boardId }, { merge: true });
      }
      return { boardId, created: false };
    }
    boardId = "";
  }

  if (!boardId) {
    const membershipSnap = await getDocs(
      query(collection(db, MEMBERS_COLLECTION), where("uid", "==", user.uid))
    );
    const adminMembership = membershipSnap.docs
      .map((docSnap) => docSnap.data() as BoardMember)
      .find((member) => isAdminRole(member.role));
    if (adminMembership) {
      boardId = adminMembership.boardId;
    }
  }

  if (boardId) {
    await ensureBoardMember(boardId, user, "admin");
    if (data.defaultBoardId !== boardId) {
      await setDoc(userRef, { defaultBoardId: boardId }, { merge: true });
    }
    return { boardId, created: false };
  }

  const board = await createBoard({
    name: "My Board",
    description: "Your personal workspace",
    createdBy: user.uid,
    projectId,
  });
  await setProjectDefaultBoard(projectId, board.id);
  await ensureBoardMember(board.id, user, "owner");
  await setDoc(userRef, { defaultBoardId: board.id }, { merge: true });
  return { boardId: board.id, created: true };
};

export const ensureBoardMember = async (
  boardId: string,
  user: User,
  role: BoardRole,
  options?: { inviteId?: string }
) => {
  const memberId = `${boardId}_${user.uid}`;
  const memberRef = doc(db, MEMBERS_COLLECTION, memberId);
  const snapshot = await getDoc(memberRef);
  const storedRole: BoardRole = role === "owner" ? "owner" : normalizeBoardRole(role);

  if (snapshot.exists()) {
    const data = snapshot.data() as BoardMember;
    const nextDisplayName = getDisplayName(user);
    if (data.displayName !== nextDisplayName || data.email !== user.email) {
      await updateDoc(memberRef, {
        displayName: nextDisplayName,
        email: user.email || data.email,
      });
    }
    return;
  }

  const payload: Record<string, unknown> = {
    boardId,
    uid: user.uid,
    role: storedRole,
    displayName: getDisplayName(user),
    email: user.email || "",
    joinedAt: Date.now(),
  };

  if (typeof options?.inviteId === "string" && options.inviteId.trim()) {
    payload.inviteId = options.inviteId.trim();
  }

  await setDoc(memberRef, payload);
};

export const subscribeBoardMembers = (
  boardId: string,
  onChange: (members: BoardMember[]) => void
) => {
  const q = query(
    collection(db, MEMBERS_COLLECTION),
    where("boardId", "==", boardId)
  );
  return onSnapshot(q, (snapshot) => {
    const members = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<BoardMember, "id">),
    }));
    const roleOrder = {
      owner: 0,
      admin: 1,
      member: 2,
    };
    const sortRole = (role: BoardRole) =>
      role === "owner" ? "owner" : normalizeBoardRole(role);
    members.sort((a, b) => {
      const roleDiff =
        roleOrder[sortRole(a.role)] - roleOrder[sortRole(b.role)];
      if (roleDiff !== 0) return roleDiff;
      return a.displayName.localeCompare(b.displayName);
    });
    onChange(members);
  });
};

export const subscribeBoardMemberships = (
  uid: string,
  onChange: (memberships: BoardMember[]) => void
) => {
  const q = query(
    collection(db, MEMBERS_COLLECTION),
    where("uid", "==", uid)
  );
  return onSnapshot(q, (snapshot) => {
    const memberships = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<BoardMember, "id">),
    }));
    onChange(memberships);
  });
};

export const sendInvite = async (params: {
  boardId: string;
  email: string;
  invitedByUid: string;
  invitedByName: string;
  role: BoardRole;
}) => {
  const payload = {
    boardId: params.boardId,
    email: normalizeEmail(params.email),
    invitedByUid: params.invitedByUid,
    invitedByName: params.invitedByName,
    role: normalizeBoardRole(params.role),
    status: "pending",
    createdAt: Date.now(),
  };
  await addDoc(collection(db, INVITES_COLLECTION), payload);
};

export const subscribeInvitesForEmail = (
  email: string,
  onChange: (invites: BoardInvite[]) => void
) => {
  const q = query(
    collection(db, INVITES_COLLECTION),
    where("email", "==", normalizeEmail(email))
  );
  return onSnapshot(q, (snapshot) => {
    const invites = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<BoardInvite, "id">),
    }));
    invites.sort((a, b) => b.createdAt - a.createdAt);
    onChange(invites);
  });
};

export const acceptInvite = async (
  invite: BoardInvite,
  user: User
) => {
  await ensureBoardMember(invite.boardId, user, invite.role, {
    inviteId: invite.id,
  });
  const inviteRef = doc(db, INVITES_COLLECTION, invite.id);
  await updateDoc(inviteRef, {
    status: "accepted",
    respondedAt: Date.now(),
  });
};

export const declineInvite = async (inviteId: string) => {
  const inviteRef = doc(db, INVITES_COLLECTION, inviteId);
  await updateDoc(inviteRef, {
    status: "declined",
    respondedAt: Date.now(),
  });
};

export const logActivity = async (entry: Omit<ActivityEntry, "id" | "createdAt">) => {
  await addDoc(collection(db, ACTIVITY_COLLECTION), {
    ...entry,
    createdAt: Date.now(),
  });
};

export const subscribeActivity = (
  boardId: string,
  onChange: (entries: ActivityEntry[]) => void
) => {
  const q = query(
    collection(db, ACTIVITY_COLLECTION),
    where("boardId", "==", boardId)
  );
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ActivityEntry, "id">),
    }));
    entries.sort((a, b) => b.createdAt - a.createdAt);
    onChange(entries.slice(0, 30));
  });
};

export const updateBoardMemberRole = async (
  memberId: string,
  role: BoardRole
) => {
  const memberRef = doc(db, MEMBERS_COLLECTION, memberId);
  await updateDoc(memberRef, { role: normalizeBoardRole(role) });
};

export const removeBoardMember = async (memberId: string) => {
  const memberRef = doc(db, MEMBERS_COLLECTION, memberId);
  await deleteDoc(memberRef);
};

export const isMemberEmail = async (boardId: string, email: string) => {
  const q = query(
    collection(db, MEMBERS_COLLECTION),
    where("boardId", "==", boardId),
    where("email", "==", normalizeEmail(email))
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
};

export const hasPendingInvite = async (boardId: string, email: string) => {
  const q = query(
    collection(db, INVITES_COLLECTION),
    where("boardId", "==", boardId),
    where("email", "==", normalizeEmail(email)),
    where("status", "==", "pending")
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
};
