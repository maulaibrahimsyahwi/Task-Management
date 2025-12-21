import { Outlet } from "react-router";
import { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import type { UiPreferences } from "../types/ui";
import type { ActivityNotification } from "../types/notifications";
import ConfirmDialog, {
  type ConfirmDialogOptions,
} from "../components/Modals/ConfirmDialog";
import { useAuth } from "../context/useAuth";
import {
  acceptInviteById,
  declineInviteById,
  subscribeInvitesForEmail,
} from "../services/collaborationService";
import type { BoardInvite } from "../types/collaboration";

const UI_PREFERENCES_STORAGE_KEY = "rtm_ui_preferences_v1";
const NOTIFICATIONS_STORAGE_KEY = "rtm_notifications_v1";
const MAX_NOTIFICATIONS = 30;
const MAX_TOASTS = 3;

const DEFAULT_UI_PREFERENCES: UiPreferences = {
  compactMode: false,
  showImages: true,
  showTags: true,
  showDescriptions: true,
};

const loadUiPreferences = (): UiPreferences => {
  try {
    const raw = localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_UI_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    return { ...DEFAULT_UI_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
};

const loadNotifications = (): ActivityNotification[] => {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityNotification[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (n) =>
          n &&
          typeof n.id === "string" &&
          typeof n.message === "string" &&
          typeof n.createdAt === "number"
      )
      .slice(0, MAX_NOTIFICATIONS);
  } catch {
    return [];
  }
};

const createId = () => {
  if ("crypto" in window && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export type LayoutOutletContext = {
  uiPreferences: UiPreferences;
  notifications: ActivityNotification[];
  addNotification: (message: string) => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
};

const SEEN_INVITES_STORAGE_KEY = "rtm_seen_invites_v1";

const loadSeenInvites = () => {
  try {
    const raw = localStorage.getItem(SEEN_INVITES_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((v) => typeof v === "string"));
  } catch {
    return new Set<string>();
  }
};

const saveSeenInvites = (ids: Set<string>) => {
  try {
    localStorage.setItem(SEEN_INVITES_STORAGE_KEY, JSON.stringify(Array.from(ids).slice(0, 200)));
  } catch {
    // ignore
  }
};

const Layout = () => {
	const { user } = useAuth();
	const didInitInvitesRef = useRef(false);
	const [uiPreferences, setUiPreferences] = useState<UiPreferences>(() =>
		loadUiPreferences()
	);
	const [notifications, setNotifications] = useState<ActivityNotification[]>(() =>
		loadNotifications()
	);
	const [toasts, setToasts] = useState<ActivityNotification[]>([]);
	const [confirmState, setConfirmState] = useState<{
		open: boolean;
		options: ConfirmDialogOptions;
		resolve?: (value: boolean) => void;
	} | null>(null);
	const [seenInviteIds, setSeenInviteIds] = useState<Set<string>>(() =>
		loadSeenInvites()
	);

	useEffect(() => {
		try {
			localStorage.setItem(
				UI_PREFERENCES_STORAGE_KEY,
				JSON.stringify(uiPreferences)
			);
		} catch {
			// ignore
		}
	}, [uiPreferences]);

	useEffect(() => {
		try {
			localStorage.setItem(
				NOTIFICATIONS_STORAGE_KEY,
				JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS))
			);
		} catch {
			// ignore
		}
	}, [notifications]);

	const addNotification = (message: string) => {
		const next: ActivityNotification = {
			id: createId(),
			message,
			createdAt: Date.now(),
		};
		setToasts((prev) => [next, ...prev].slice(0, MAX_TOASTS));
	};

	const pushInboxNotification = (
		message: string,
		extra?: Partial<ActivityNotification>
	) => {
		const next: ActivityNotification = {
			id: createId(),
			message,
			createdAt: Date.now(),
			...extra,
		};
		setNotifications((prev) => [next, ...prev].slice(0, MAX_NOTIFICATIONS));
		// Also show a toast for immediate feedback
		setToasts((prev) => [next, ...prev].slice(0, MAX_TOASTS));
	};

	const clearNotifications = () => setNotifications([]);
	const removeNotification = (id: string) =>
		setNotifications((prev) => prev.filter((n) => n.id !== id));

	useEffect(() => {
		if (toasts.length === 0) return;
		const t = window.setTimeout(() => {
			setToasts((prev) => prev.slice(0, -1));
		}, 2400);
		return () => window.clearTimeout(t);
	}, [toasts]);

	useEffect(() => {
		saveSeenInvites(seenInviteIds);
	}, [seenInviteIds]);

	useEffect(() => {
		if (!user?.email) return;
		const email = user.email;
		return subscribeInvitesForEmail(email, (invites: BoardInvite[]) => {
			const pending = invites.filter((i) => i.status === "pending");
			if (!didInitInvitesRef.current) {
				didInitInvitesRef.current = true;
				setSeenInviteIds((prev) => {
					const next = new Set(prev);
					pending.forEach((invite) => next.add(invite.id));
					return next;
				});
				return;
			}
			setSeenInviteIds((prev) => {
				const nextSeen = new Set(prev);
				let changed = false;

				pending.forEach((invite) => {
					if (nextSeen.has(invite.id)) return;
					nextSeen.add(invite.id);
					changed = true;
					pushInboxNotification(
						`Undangan baru dari ${invite.invitedByName} sebagai ${invite.role}.`,
						{
							kind: "invite",
							inviteId: invite.id,
							boardId: invite.boardId,
							role: invite.role,
							invitedByName: invite.invitedByName,
						}
					);
				});

				return changed ? nextSeen : prev;
			});
		});
	}, [user?.email]);

	const handleAcceptInvite = async (notificationId: string, inviteId?: string) => {
		if (!inviteId || !user) return;
		try {
			await acceptInviteById(inviteId, user);
			removeNotification(notificationId);
			addNotification("Invite accepted");
		} catch (e) {
			const message =
				e instanceof Error ? e.message : "Failed to accept invite.";
			console.error(message, e);
			addNotification(message);
		}
	};

	const handleDeclineInvite = async (notificationId: string, inviteId?: string) => {
		if (!inviteId) return;
		try {
			await declineInviteById(inviteId);
			removeNotification(notificationId);
			addNotification("Invite declined");
		} catch (e) {
			const message =
				e instanceof Error ? e.message : "Failed to decline invite.";
			console.error(message, e);
			addNotification(message);
		}
	};

	const confirm = (options: ConfirmDialogOptions) =>
		new Promise<boolean>((resolve) => {
			setConfirmState({ open: true, options, resolve });
		});

	const closeConfirm = (value: boolean) => {
		setConfirmState((prev) => {
			prev?.resolve?.(value);
			return null;
		});
	};

	return (
		<div className="w-screen h-screen relative bg-slate-50 text-slate-900">
			<Sidebar />
			<Navbar
				uiPreferences={uiPreferences}
				onUiPreferencesChange={setUiPreferences}
				notifications={notifications}
				onClearNotifications={clearNotifications}
				onRemoveNotification={removeNotification}
				onAcceptInvite={handleAcceptInvite}
				onDeclineInvite={handleDeclineInvite}
			/>
			<div className="md:pl-[230px] pl-[60px] pr-4 pt-[70px] w-full h-full overflow-y-auto">
				<Outlet
					context={{
						uiPreferences,
						notifications,
						addNotification,
						clearNotifications,
						removeNotification,
						confirm,
					}}
				/>
			</div>
			{toasts.length ? (
				<div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2">
					{toasts.map((t) => (
						<div
							key={t.id}
							className="min-w-[260px] max-w-[360px] rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-lg"
						>
							<div className="text-sm font-semibold">{t.message}</div>
						</div>
					))}
				</div>
			) : null}
			<ConfirmDialog
				open={!!confirmState?.open}
				options={
					confirmState?.options || {
						title: "Confirm",
					}
				}
				onCancel={() => closeConfirm(false)}
				onConfirm={() => closeConfirm(true)}
			/>
		</div>
	);
};

export default Layout;
