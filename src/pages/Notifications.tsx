import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCheck,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notification.service";
import type { NotificationItem } from "../services/notification.service";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function safeInternalHref(href: string | null): string | null {
  if (!href || !href.startsWith("/") || href.startsWith("//")) {
    return null;
  }

  if (/[\u0000-\u001f\u007f]/.test(href)) return null;

  return href;
}

export function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    setError(null);

    try {
      const result = await getNotifications({
        page: 1,
        pageSize: 50,
        signal,
      });

      if (signal?.aborted) return;

      setItems(result.data);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      if (signal?.aborted) return;

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load notifications. Please try again.",
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadNotifications(controller.signal);

    return () => controller.abort();
  }, [loadNotifications]);

  const refresh = async () => {
    setRefreshing(true);
    await loadNotifications();
  };

  const markOneRead = async (item: NotificationItem) => {
    if (item.readAt || markingId) return;

    setMarkingId(item.id);
    setError(null);

    try {
      await markNotificationAsRead(item.id);

      setItems((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, readAt: new Date().toISOString() }
            : notification,
        ),
      );

      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to mark this notification as read.",
      );
    } finally {
      setMarkingId(null);
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;

    setMarkingAll(true);
    setError(null);

    try {
      await markAllNotificationsAsRead();

      const now = new Date().toISOString();

      setItems((current) =>
        current.map((item) =>
          item.readAt ? item : { ...item, readAt: now },
        ),
      );

      setUnreadCount(0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to mark notifications as read.",
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const openNotification = async (item: NotificationItem) => {
    if (!item.readAt) {
      await markOneRead(item);
    }

    const href = safeInternalHref(item.href);
    if (href) navigate(href);
  };

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Bell size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Notifications
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Updates about your leave requests and reviews.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
            {unreadCount} unread
          </span>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing || loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0 || markingAll || loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAll ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <CheckCheck size={16} />
            )}
            Mark all read
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-1 break-words">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-2 font-semibold underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-slate-500">
            <LoaderCircle size={28} className="animate-spin text-blue-600" />
            <p className="text-sm">Loading notifications…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Bell size={25} />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              You’re all caught up
            </h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              New leave request updates and review notifications will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const isUnread = !item.readAt;
              const href = safeInternalHref(item.href);
              const isMarking = markingId === item.id;

              return (
                <li
                  key={item.id}
                  className={`flex gap-3 p-4 transition-colors sm:gap-4 sm:p-5 ${
                    isUnread ? "bg-blue-50/50" : "bg-white"
                  }`}
                >
                  <span
                    className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      isUnread
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Bell size={18} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-sm font-semibold text-slate-900">
                        {item.title}
                      </h2>
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Unread" />
                      )}
                    </div>

                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                      {item.message}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      {formatDate(item.createdAt)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3">
                      {href && (
                        <button
                          type="button"
                          onClick={() => void openNotification(item)}
                          className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                        >
                          View details
                        </button>
                      )}

                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => void markOneRead(item)}
                          disabled={isMarking}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                        >
                          {isMarking ? (
                            <LoaderCircle size={14} className="animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && items.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:px-5">
            Showing the latest {items.length} notifications.
          </div>
        )}
      </div>
    </section>
  );
}

export default Notifications;
