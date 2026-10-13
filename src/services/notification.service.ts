/**
 * ZIYA HR — Notification API Service
 *
 * Uses the existing production API and authenticated session cookie.
 * The backend remains responsible for authentication and tenant isolation.
 */

const DEFAULT_API_BASE_URL =
  "https://ziya-hr-api-production.up.railway.app";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

const NOTIFICATIONS_ENDPOINT = "/api/notifications";
const REQUEST_TIMEOUT_MS = 30_000;

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  data: NotificationItem[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}

interface NotificationApiError {
  message?: string;
  error?: string | { message?: string };
}

async function notificationRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${API_BASE_URL}${NOTIFICATIONS_ENDPOINT}${path}`,
      {
        ...options,
        credentials: "include",
        cache: "no-store",
        signal: options.signal ?? controller.signal,
        headers: {
          Accept: "application/json",
          ...(options.headers ?? {}),
        },
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | (NotificationApiError & Record<string, unknown>)
      | null;

    if (!response.ok) {
      const nestedError = payload?.error;
      const message =
        typeof nestedError === "string"
          ? nestedError
          : nestedError &&
              typeof nestedError === "object" &&
              "message" in nestedError
            ? nestedError.message
            : payload?.message;

      throw new Error(
        typeof message === "string"
          ? message
          : `Notification request failed (${response.status}).`,
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The notification request timed out or was cancelled.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getNotifications(options?: {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
  signal?: AbortSignal;
}): Promise<NotificationListResult> {
  const params = new URLSearchParams({
    page: String(Math.max(1, Math.floor(options?.page ?? 1))),
    pageSize: String(
      Math.min(
        100,
        Math.max(1, Math.floor(options?.pageSize ?? 20)),
      ),
    ),
  });

  if (options?.unreadOnly) {
    params.set("unread", "true");
  }

  const result = await notificationRequest<NotificationListResult>(
    `?${params.toString()}`,
    { signal: options?.signal },
  );

  return {
    ...result,
    data: Array.isArray(result?.data) ? result.data : [],
    unreadCount: Number.isFinite(Number(result?.unreadCount))
      ? Number(result.unreadCount)
      : 0,
  };
}

export async function getUnreadNotificationCount(
  signal?: AbortSignal,
): Promise<number> {
  const result = await notificationRequest<{
    unreadCount?: number;
  }>("/unread-count", { signal });

  const count = Number(result?.unreadCount);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<NotificationItem> {
  if (!notificationId.trim()) {
    throw new Error("A notification ID is required.");
  }

  return notificationRequest<NotificationItem>(
    `/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH" },
  );
}

export async function markAllNotificationsAsRead(): Promise<{
  updatedCount: number;
}> {
  return notificationRequest<{ updatedCount: number }>(
    "/read-all",
    { method: "PATCH" },
  );
}
