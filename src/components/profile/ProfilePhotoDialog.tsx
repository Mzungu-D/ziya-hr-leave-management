import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import {
  PROFILE_PICTURE_ACCEPT,
  removeProfilePicture,
  uploadProfilePicture,
  useProfilePicture,
  validateProfilePictureFile,
} from "../../services/profile-picture.service";

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  HR_ADMIN: "HR Administrator",
  SUPER_ADMIN: "Super Administrator",
};

interface ProfilePhotoDialogProps {
  open: boolean;
  onClose: () => void;
}

function ProfilePhotoDialogContent({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { url: currentUrl } = useProfilePicture(user?.id);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && busy === null) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onClose]);

  if (!user) {
    return null;
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;

  const initials =
    `${user.firstName?.trim().charAt(0) ?? ""}${user.lastName?.trim().charAt(0) ?? ""}`.toUpperCase() ||
    "U";

  const shownUrl = previewUrl ?? currentUrl;
  const working = busy !== null;

  const handleSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    setMessage(null);

    if (!selected) {
      return;
    }

    const problem = validateProfilePictureFile(selected);

    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const clearSelection = () => {
    setFile(null);
    setPreviewUrl(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file || working) {
      return;
    }

    setBusy("upload");
    setError(null);
    setMessage(null);

    try {
      await uploadProfilePicture(user.id, file);
      setFile(null);
      setPreviewUrl(null);
      setMessage("Your profile photo has been updated.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload the photo. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    if (working || !window.confirm("Remove your profile photo?")) {
      return;
    }

    setBusy("remove");
    setError(null);
    setMessage(null);

    try {
      await removeProfilePicture(user.id);
      setMessage("Your profile photo has been removed.");
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Unable to remove the photo. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-photo-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !working) {
          onClose();
        }
      }}
    >
      <div className="max-h-[95dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="profile-photo-title" className="text-lg font-bold text-slate-900">
              Profile photo
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              This is how you appear across Ziya HR.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center text-center">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-[#071a35] text-3xl font-bold text-white ring-4 ring-slate-100">
            {shownUrl ? (
              <img src={shownUrl} alt="Your profile photo" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{initials}</span>
            )}
          </div>

          <p className="mt-4 max-w-full truncate text-base font-semibold text-slate-900">
            {displayName}
          </p>
          <p className="text-sm text-slate-500">{ROLE_LABELS[user.role] ?? user.role}</p>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          >
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">{error}</span>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
          >
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">{message}</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={PROFILE_PICTURE_ACCEPT}
          onChange={handleSelect}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        <div className="mt-6 space-y-2">
          {file ? (
            <>
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={working}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#071a35] px-4 text-sm font-semibold text-white transition hover:bg-[#0b2448] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "upload" ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Camera size={17} />
                )}
                {busy === "upload" ? "Uploading..." : "Save this photo"}
              </button>

              <button
                type="button"
                onClick={clearSelection}
                disabled={working}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Choose a different photo
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={working}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#071a35] px-4 text-sm font-semibold text-white transition hover:bg-[#0b2448] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Camera size={17} />
                {currentUrl ? "Change photo" : "Choose a photo"}
              </button>

              {currentUrl && (
                <button
                  type="button"
                  onClick={() => void handleRemove()}
                  disabled={working}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                >
                  {busy === "remove" ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Trash2 size={17} />
                  )}
                  {busy === "remove" ? "Removing..." : "Remove photo"}
                </button>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          JPEG, PNG or WebP, up to 5 MB. Your photo is private and visible only to you and HR.
        </p>
      </div>
    </div>
  );
}

export function ProfilePhotoDialog({ open, onClose }: ProfilePhotoDialogProps) {
  if (!open) {
    return null;
  }

  return <ProfilePhotoDialogContent onClose={onClose} />;
}