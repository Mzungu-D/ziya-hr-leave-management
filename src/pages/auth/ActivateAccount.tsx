import { useState, type FormEvent } from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";

import { resetPassword } from "../../services/auth.service";

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const message = (
      error as { message?: unknown }
    ).message;

    if (
      typeof message === "string" &&
      message.trim()
    ) {
      return message;
    }
  }

  return "This link could not be used. Ask HR to send a new invitation.";
}

export function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const isInvitation = searchParams.get("invite") === "1";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError(
        "This link is missing its security token. Ask HR to send a new invitation.",
      );
      return;
    }

    if (password.length < 12) {
      setError("Your password must contain at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      await resetPassword({
        token,
        password,
        confirmPassword,
      });

      setCompleted(true);
      setPassword("");
      setConfirmPassword("");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b88900]">
          Ziya People &amp; Culture
        </p>

        {completed ? (
          <>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">
              {isInvitation ? "Account activated" : "Password updated"}
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {isInvitation
                ? "Your account is ready. Sign in using the email address or phone number HR added to your employee record."
                : "Your password has been updated. Sign in with your new password."}
            </p>

            <Link
              to="/login"
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#071a35] px-4 text-sm font-bold text-white hover:bg-[#0b2448]"
            >
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">
              {isInvitation
                ? "Activate your account"
                : "Choose a new password"}
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {isInvitation
                ? "Create a password to activate your employee account. After activation, sign in using your registered email or phone number."
                : "Create a new password for your account, then sign in again."}
            </p>

            {!token ? (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
              >
                This link is missing its security token or has expired. Ask HR
                to send a new invitation.
              </div>
            ) : (
              <form
                className="mt-6 space-y-4"
                onSubmit={handleSubmit}
              >
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Password
                  </label>

                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#d8a415] focus:ring-4 focus:ring-[#d8a415]/10"
                  />

                  <p className="mt-1 text-xs text-slate-500">
                    Use at least 12 characters.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Confirm password
                  </label>

                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#d8a415] focus:ring-4 focus:ring-[#d8a415]/10"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-12 w-full rounded-xl bg-[#071a35] px-4 text-sm font-bold text-white hover:bg-[#0b2448] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Saving password…"
                    : isInvitation
                      ? "Activate account"
                      : "Reset password"}
                </button>
              </form>
            )}
          </>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link
            to="/login"
            className="font-semibold text-[#071a35] hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
