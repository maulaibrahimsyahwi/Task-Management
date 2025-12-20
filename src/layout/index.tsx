import { Outlet } from "react-router";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import type { UiPreferences } from "../types/ui";
import type { ActivityNotification } from "../types/notifications";

const UI_PREFERENCES_STORAGE_KEY = "rtm_ui_preferences_v1";
const NOTIFICATIONS_STORAGE_KEY = "rtm_notifications_v1";
const MAX_NOTIFICATIONS = 30;

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
  searchQuery: string;
  uiPreferences: UiPreferences;
  notifications: ActivityNotification[];
  addNotification: (message: string) => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;
};

const Layout = () => {
	const [searchQuery, setSearchQuery] = useState("");
	const [uiPreferences, setUiPreferences] = useState<UiPreferences>(() =>
		loadUiPreferences()
	);
	const [notifications, setNotifications] = useState<ActivityNotification[]>(() =>
		loadNotifications()
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
		setNotifications((prev) => [next, ...prev].slice(0, MAX_NOTIFICATIONS));
	};

	const clearNotifications = () => setNotifications([]);
	const removeNotification = (id: string) =>
		setNotifications((prev) => prev.filter((n) => n.id !== id));

	return (
		<div className="w-screen h-screen relative">
			<Sidebar />
			<Navbar
				searchQuery={searchQuery}
				onSearchQueryChange={setSearchQuery}
				uiPreferences={uiPreferences}
				onUiPreferencesChange={setUiPreferences}
				notifications={notifications}
				onClearNotifications={clearNotifications}
				onRemoveNotification={removeNotification}
			/>
			<div className="md:pl-[250px] pl-[60px] pr-[20px] pt-[70px] w-full h-full overflow-y-auto">
				<Outlet
					context={{
						searchQuery,
						uiPreferences,
						notifications,
						addNotification,
						clearNotifications,
						removeNotification,
					}}
				/>
			</div>
		</div>
	);
};

export default Layout;
