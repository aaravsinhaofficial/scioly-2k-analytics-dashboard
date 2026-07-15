"use client";

import { useId, useRef, useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

interface DeleteAccountPanelProps {
  email: string;
}

export function DeleteAccountPanel({ email }: DeleteAccountPanelProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const emailMatches = confirmationEmail.trim().toLowerCase() === email.trim().toLowerCase();

  async function deleteAccount() {
    if (!emailMatches || isDeleting) return;
    setError(null);
    setIsDeleting(true);

    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationEmail })
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Account deletion is temporarily unavailable.");
      }
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Account deletion could not be completed.");
      }
      window.location.assign("/login?account_deleted=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account deletion could not be completed.");
      setIsDeleting(false);
    }
  }

  if (!isConfirming) {
    return (
      <section className="rounded-md border border-red-400/30 bg-red-400/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Delete account</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              Permanently remove your login and anonymize your profile.
            </p>
          </div>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsConfirming(true)}
            aria-expanded={false}
            aria-controls={panelId}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-red-400/50 px-4 text-sm font-semibold text-red-200 transition hover:border-red-300 hover:bg-red-300/10 hover:text-white"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete account
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id={panelId} className="rounded-md border border-red-400/50 bg-red-400/10 p-5" aria-labelledby={`${panelId}-title`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-200" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id={`${panelId}-title`} className="text-lg font-semibold text-white">Permanently delete your account?</h2>
          <p id={`${panelId}-description`} className="mt-2 text-sm leading-6 text-zinc-400">
            Your login will be permanently removed, your public profile will be anonymized, and you will be removed from your current team. Historical competition, point, team, and operational audit/import records are retained and may still contain details required for recordkeeping. This cannot be undone.
          </p>

          <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-300">
            Type <span className="break-all font-semibold text-white">{email}</span> to confirm
            <input
              type="email"
              value={confirmationEmail}
              onChange={(event) => setConfirmationEmail(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              disabled={isDeleting}
              aria-describedby={`${panelId}-description ${panelId}-match-help`}
              aria-invalid={confirmationEmail.length > 0 && !emailMatches}
              className="h-11 rounded-md border border-red-400/40 bg-court-black px-3 text-sm text-white outline-none transition focus:border-red-300 disabled:opacity-60"
            />
            <span id={`${panelId}-match-help`} className="text-xs font-normal text-zinc-400" aria-live="polite">
              {!confirmationEmail ? "The delete button unlocks only after the email matches." : emailMatches ? "Email matches. Review the warning before deleting." : "Email does not match."}
            </span>
          </label>

          {error ? <div className="mt-3 rounded-md border border-red-400/40 bg-court-black p-3 text-sm text-red-200" role="alert">{error}</div> : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={!emailMatches || isDeleting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-red-300 px-4 text-sm font-semibold text-black transition hover:bg-red-200 disabled:cursor-not-allowed disabled:bg-court-elevated disabled:text-zinc-500"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              {isDeleting ? "Deleting account…" : "Permanently delete account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsConfirming(false);
                setConfirmationEmail("");
                setError(null);
                requestAnimationFrame(() => triggerRef.current?.focus());
              }}
              disabled={isDeleting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-court-line px-4 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Cancel
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
