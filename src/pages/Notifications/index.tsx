import { useOutletContext } from "react-router";
import type { LayoutOutletContext } from "../../layout";

const Notifications = () => {
  const { notifications, clearNotifications, removeNotification } =
    useOutletContext<LayoutOutletContext>();

  return (
    <div className="w-full flex flex-col gap-6 pb-8">
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <div className="text-lg font-bold text-gray-800">Notifications</div>
        <div className="text-sm text-gray-600">
          Your recent activity will appear here.
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-gray-700 font-semibold">
            {notifications.length} total
          </div>
          <button
            type="button"
            onClick={clearNotifications}
            disabled={notifications.length === 0}
            className="text-sm font-bold text-orange-500 hover:text-orange-600 disabled:opacity-50"
          >
            Clear all
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="mt-4 text-sm text-gray-600">No notifications yet.</div>
        ) : (
          <div className="mt-4 flex flex-col">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="w-full py-3 border-b border-gray-100 flex items-start justify-between gap-3"
              >
                <div className="flex flex-col">
                  <div className="text-sm font-semibold text-gray-800">
                    {n.message}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeNotification(n.id)}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
