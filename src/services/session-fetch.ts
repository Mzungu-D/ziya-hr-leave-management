const DEFAULT_API_BASE_URL =
  "https://ziya-hr-api-production.up.railway.app";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  DEFAULT_API_BASE_URL
)
  .trim()
  .replace(/\/+$/, "");

let installed = false;

export function installSessionFetchRecovery(): void {
  if (installed || typeof window === "undefined") {
    return;
  }

  installed = true;

  const nativeFetch = window.fetch.bind(window);
  let refreshInFlight: Promise<boolean> | null = null;

  function isApiRequest(requestUrl: string): boolean {
    try {
      const apiUrl = new URL(API_BASE_URL);
      const targetUrl = new URL(requestUrl);

      return (
        targetUrl.origin === apiUrl.origin &&
        targetUrl.pathname.startsWith("/api/")
      );
    } catch {
      return false;
    }
  }

  function shouldAttemptRefresh(pathname: string): boolean {
    if (pathname === "/api/health") {
      return false;
    }

    if (pathname === "/api/auth/session") {
      return true;
    }

    // Login, OTP, logout, refresh, and password-reset requests
    // have their own authentication behavior.
    if (pathname.startsWith("/api/auth/")) {
      return false;
    }

    return pathname.startsWith("/api/");
  }

  function refreshSessionOnce(): Promise<boolean> {
    if (!refreshInFlight) {
      refreshInFlight = nativeFetch(
        `${API_BASE_URL}/api/auth/refresh`,
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      )
        .then((response) => response.ok)
        .catch(() => false)
        .finally(() => {
          refreshInFlight = null;
        });
    }

    return refreshInFlight;
  }

  function sendToLogin(): void {
    if (window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  }

  const recoveredFetch: typeof window.fetch = async (
    input,
    init,
  ) => {
    const request = new Request(input, init);

    if (!isApiRequest(request.url)) {
      return nativeFetch(request);
    }

    const apiRequest =
      request.credentials === "include"
        ? request
        : new Request(request, {
            credentials: "include",
          });

    // Clone before the first request so POST/PATCH bodies can be
    // replayed once after the session refreshes.
    const retryRequest = apiRequest.clone();
    const targetUrl = new URL(apiRequest.url);

    const response = await nativeFetch(apiRequest);

    if (
      response.status !== 401 ||
      !shouldAttemptRefresh(targetUrl.pathname)
    ) {
      return response;
    }

    const refreshed = await refreshSessionOnce();

    if (!refreshed) {
      if (targetUrl.pathname !== "/api/auth/session") {
        sendToLogin();
      }

      return response;
    }

    const retriedResponse =
      await nativeFetch(retryRequest);

    if (
      retriedResponse.status === 401 &&
      targetUrl.pathname !== "/api/auth/session"
    ) {
      sendToLogin();
    }

    return retriedResponse;
  };

  window.fetch = recoveredFetch;
}
