import {
  ChevronDown,
  Bell,
  UserCircle,
  Settings,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Link, useLocation } from "react-router-dom";
import type { UiPreferences } from "../../types/ui";
import type { ActivityNotification } from "../../types/notifications";
import { useProjects } from "../../context/useProjects";

type NavbarProps = {
  uiPreferences: UiPreferences;
  onUiPreferencesChange: Dispatch<SetStateAction<UiPreferences>>;
  notifications: ActivityNotification[];
  onClearNotifications: () => void;
  onRemoveNotification: (id: string) => void;
};

type OpenMenu = "pages" | "settings" | "notifications" | null;

const Navbar = ({
  uiPreferences,
  onUiPreferencesChange,
  notifications,
  onClearNotifications,
  onRemoveNotification,
}: NavbarProps) => {
  const { activeProjectId } = useProjects();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [toast, setToast] = useState<string | null>(null);

  const navItems = useMemo(
    () => [
      { title: "Home", to: "/home", matchPrefix: "/home" },
      { title: "Projects", to: "/projects", matchPrefix: "/projects" },
      {
        title: "Analytics",
        to: activeProjectId ? `/analytics/${activeProjectId}` : "/analytics",
        matchPrefix: "/analytics",
      },
    ],
    [activeProjectId]
  );

  const pageTitle = useMemo(() => {
    const item = navItems.find(
      (i) =>
        location.pathname === i.matchPrefix ||
        location.pathname.startsWith(`${i.matchPrefix}/`)
    );
    if (item) return item.title;
    if (location.pathname.startsWith("/board")) return "Board";
    if (location.pathname.startsWith("/projects")) return "Projects";
    if (location.pathname.startsWith("/analytics")) return "Analytics";
    if (location.pathname.startsWith("/home")) return "Home";
    return "Board";
  }, [location.pathname, navItems]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpenMenu(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast("Link copied.");
    } catch {
      setToast("Copy failed.");
    }
  };

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

  return (
    <div
      ref={containerRef}
      className="md:w-[calc(100%-230px)] w-[calc(100%-60px)] fixed flex items-center justify-between pl-2 pr-6 h-[70px] top-0 md:left-[230px] left-[60px] border-b border-slate-200 bg-white/90 backdrop-blur z-40"
    >
      <div
        className="flex items-center gap-3 cursor-pointer relative"
        onClick={() => setOpenMenu((m) => (m === "pages" ? null : "pages"))}
      >
        <UserCircle color="#fb923c" size={28} />
        <span className="text-orange-400 font-semibold md:text-lg text-sm whitespace-nowrap">
          {pageTitle}
        </span>
        <ChevronDown color="#fb923c" size={16} />

        {openMenu === "pages" ? (
          <div className="absolute top-[55px] left-0 w-[220px] bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden z-50">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.matchPrefix ||
                location.pathname.startsWith(`${item.matchPrefix}/`);
              return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpenMenu(null)}
                className={`w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 text-sm font-semibold ${
                  isActive
                    ? "text-orange-500"
                    : "text-gray-700"
                }`}
              >
                <span>{item.title}</span>
                {isActive ? (
                  <span className="text-xs font-bold">Active</span>
                ) : null}
              </Link>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="md:flex hidden items-center gap-4 relative">
        <div
          className="grid place-items-center bg-gray-100 rounded-full p-2 cursor-pointer hover:bg-gray-200"
          onClick={copyShareLink}
          title="Copy link"
        >
          <Share2 color={"#444"} size={20} />
        </div>

        <div
          className="grid place-items-center bg-gray-100 rounded-full p-2 cursor-pointer hover:bg-gray-200"
          onClick={() =>
            setOpenMenu((m) => (m === "settings" ? null : "settings"))
          }
          title="Settings"
        >
          <Settings color={"#444"} size={20} />
        </div>
        {openMenu === "settings" ? (
          <div className="absolute top-[55px] right-0 w-[260px] bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-gray-100 text-sm font-bold text-gray-800">
              View settings
            </div>

            <label className="w-full px-3 py-2 flex items-center justify-between text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
              <span>Compact mode</span>
              <input
                type="checkbox"
                checked={uiPreferences.compactMode}
                onChange={(e) =>
                  onUiPreferencesChange((p) => ({
                    ...p,
                    compactMode: e.target.checked,
                  }))
                }
              />
            </label>
            <label className="w-full px-3 py-2 flex items-center justify-between text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
              <span>Show images</span>
              <input
                type="checkbox"
                checked={uiPreferences.showImages}
                onChange={(e) =>
                  onUiPreferencesChange((p) => ({
                    ...p,
                    showImages: e.target.checked,
                  }))
                }
              />
            </label>
            <label className="w-full px-3 py-2 flex items-center justify-between text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
              <span>Show tags</span>
              <input
                type="checkbox"
                checked={uiPreferences.showTags}
                onChange={(e) =>
                  onUiPreferencesChange((p) => ({
                    ...p,
                    showTags: e.target.checked,
                  }))
                }
              />
            </label>
            <label className="w-full px-3 py-2 flex items-center justify-between text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
              <span>Show descriptions</span>
              <input
                type="checkbox"
                checked={uiPreferences.showDescriptions}
                onChange={(e) =>
                  onUiPreferencesChange((p) => ({
                    ...p,
                    showDescriptions: e.target.checked,
                  }))
                }
              />
            </label>
          </div>
        ) : null}

        <div
          className="relative grid place-items-center bg-gray-100 rounded-full p-2 cursor-pointer hover:bg-gray-200"
          onClick={() =>
            setOpenMenu((m) => (m === "notifications" ? null : "notifications"))
          }
          title="Notifications"
        >
          <Bell color={"#444"} size={20} />
          {notifications.length ? (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
              {notifications.length}
            </span>
          ) : null}
        </div>

        {openMenu === "notifications" ? (
          <div className="absolute top-[55px] right-0 w-[340px] bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-800">
                Notifications
              </span>
              <button
                type="button"
                onClick={onClearNotifications}
                disabled={notifications.length === 0}
                className="text-xs font-bold text-orange-500 hover:text-orange-600 disabled:opacity-50"
              >
                Clear all
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-600">
                No notifications yet.
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="px-3 py-2 flex items-start gap-2 hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-800">
                        {n.message}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {formatTimeAgo(n.createdAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveNotification(n.id)}
                      className="grid place-items-center rounded-full hover:bg-gray-200 p-1"
                      title="Dismiss"
                    >
                      <X size={16} color="#666" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {toast ? (
          <div className="absolute top-[70px] right-0 bg-gray-900 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-md">
            {toast}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Navbar;
