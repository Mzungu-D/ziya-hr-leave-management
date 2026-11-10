import { useEffect, useSyncExternalStore } from "react";

/**
 * Profile-picture client.
 *
 * Pictures live in private storage behind the session cookie, so they are
 * fetched with credentials and displayed through blob URLs. The route paths
 * below were set when this file was generated.
 */

const DEFAULT_API_BASE_URL = "https://ziya-hr-api-production.up.railway.app";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

const ROUTES: {
  meta: string;
  image: string;
  upload: string;
  remove: string;
} = {
  meta: "/api/employees/:employeeId/profile-picture",
  image: "/api/employees/:employeeId/profile-picture/image",
  upload: "/api/employees/:employeeId/profile-picture",
  remove: "/api/employees/:employeeId/profile-picture",
};

const UPLOAD_METHOD: string = "POST";
const REMOVE_METHOD: string = "DELETE";

export const PROFILE_PICTURE_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PICTURE_ACCEPT = "image/jpeg,image/png,image/webp";

const ACCEPTED_TYPES: readonly string[] = PROFILE_PICTURE_ACCEPT.split(",");

export class ProfilePictureError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProfilePictureError";
    this.status = status;
  }
}

export function validateProfilePictureFile(file: File): string | null {
  if (file.size === 0) {
    return "That file is empty. Choose a different image.";
  }

  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Choose a JPEG, PNG or WebP image.";
  }

  if (file.size > PROFILE_PICTURE_MAX_BYTES) {
    return "The image must be 5 MB or smaller.";
  }

  return null;
}

function resolvePath(template: string, employeeId: string): string {
  return template.replace(/:[A-Za-z_]+/, encodeURIComponent(employeeId));
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 30_000);

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    throw new ProfilePictureError(
      error instanceof DOMException && error.name === "AbortError"
        ? "The request timed out. Please try again."
        : "Network error. Check your connection and try again.",
      0,
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function readError(response: Response, fallback: string): Promise<ProfilePictureError> {
  let message = fallback;

  try {
    const payload = (await response.json()) as {
      message?: string;
      error?: string | { message?: string };
    };

    const nested = payload.error;
    const text =
      typeof nested === "string" ? nested : (nested?.message ?? payload.message);

    if (typeof text === "string" && text.trim()) {
      message = text;
    }
  } catch {
    // keep the fallback message
  }

  return new ProfilePictureError(message, response.status);
}

/* ------------------------------ shared store ------------------------------ */

export interface ProfilePictureState {
  url: string | null;
  status: "idle" | "loading" | "ready" | "empty" | "error";
}

const IDLE: ProfilePictureState = { url: null, status: "idle" };

const states = new Map<string, ProfilePictureState>();
const listeners = new Set<() => void>();
const inflight = new Map<string, Promise<void>>();

function setState(employeeId: string, next: ProfilePictureState): void {
  const previous = states.get(employeeId);

  if (previous?.url && previous.url !== next.url) {
    URL.revokeObjectURL(previous.url);
  }

  states.set(employeeId, next);
  listeners.forEach((listener) => listener());
}

function keepPreviousAndFail(employeeId: string): void {
  setState(employeeId, {
    url: states.get(employeeId)?.url ?? null,
    status: "error",
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function loadProfilePicture(employeeId: string, force = false): Promise<void> {
  const current = states.get(employeeId);

  if (!force && current && current.status !== "idle" && current.status !== "error") {
    return Promise.resolve();
  }

  const running = inflight.get(employeeId);

  if (running) {
    return running;
  }

  const task = (async () => {
    setState(employeeId, { url: current?.url ?? null, status: "loading" });

    try {
      if (ROUTES.meta) {
        const meta = await request(resolvePath(ROUTES.meta, employeeId), {
          headers: { Accept: "application/json" },
        });

        if (meta.status === 401 || meta.status === 403) {
          keepPreviousAndFail(employeeId);
          return;
        }

        if (meta.ok) {
          const payload = (await meta.json().catch(() => null)) as
            | { data?: unknown }
            | null;

          if (payload && (payload.data === null || payload.data === undefined)) {
            setState(employeeId, { url: null, status: "empty" });
            return;
          }
        }
      }

      const image = await request(resolvePath(ROUTES.image, employeeId), {
        headers: { Accept: "image/*" },
      });

      if (image.status === 404) {
        setState(employeeId, { url: null, status: "empty" });
        return;
      }

      if (!image.ok) {
        keepPreviousAndFail(employeeId);
        return;
      }

      const blob = await image.blob();
      setState(employeeId, { url: URL.createObjectURL(blob), status: "ready" });
    } catch {
      keepPreviousAndFail(employeeId);
    }
  })();

  const tracked = task.finally(() => {
    inflight.delete(employeeId);
  });

  inflight.set(employeeId, tracked);
  return tracked;
}

export async function uploadProfilePicture(employeeId: string, file: File): Promise<void> {
  const body = new FormData();
  body.append("file", file);

  const response = await request(resolvePath(ROUTES.upload, employeeId), {
    method: UPLOAD_METHOD,
    body,
  });

  if (!response.ok) {
    throw await readError(response, "Unable to upload the profile picture.");
  }

  await loadProfilePicture(employeeId, true);
}

export async function removeProfilePicture(employeeId: string): Promise<void> {
  const response = await request(resolvePath(ROUTES.remove, employeeId), {
    method: REMOVE_METHOD,
  });

  if (!response.ok) {
    throw await readError(response, "Unable to remove the profile picture.");
  }

  setState(employeeId, { url: null, status: "empty" });
}

export function useProfilePicture(employeeId: string | null | undefined): {
  url: string | null;
  loading: boolean;
} {
  const state = useSyncExternalStore(
    subscribe,
    () => (employeeId ? (states.get(employeeId) ?? IDLE) : IDLE),
    () => IDLE,
  );

  useEffect(() => {
    if (employeeId) {
      void loadProfilePicture(employeeId);
    }
  }, [employeeId]);

  return {
    url: state.url,
    loading:
      Boolean(employeeId) && (state.status === "idle" || state.status === "loading"),
  };
}