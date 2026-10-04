"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Link2, Loader2, Paperclip, PlusCircle, X } from "lucide-react";
import { activityHelp, activityLabels, calculateActivityPoints } from "@/lib/activity";
import {
  MAX_POINT_EVIDENCE_FILES,
  MAX_POINT_EVIDENCE_FILE_BYTES,
  MAX_POINT_EVIDENCE_TOTAL_BYTES,
  normalizeEvidenceMimeType,
  normalizeGoogleDriveUrl,
  POINT_EVIDENCE_MIME_TYPES
} from "@/lib/point-evidence";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { ActivityType, CustomPointCategory, Student } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface QuickPointLogFormProps {
  currentUser: Student;
}

const activityTypes = Object.keys(activityLabels) as ActivityType[];

interface EvidenceUploadTicket {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  token: string;
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function QuickPointLogForm({ currentUser }: QuickPointLogFormProps) {
  const router = useRouter();
  const [activityType, setActivityType] = useState<ActivityType>("solo_study");
  const [minutes, setMinutes] = useState(60);
  const [quantity, setQuantity] = useState(50);
  const [customPoints, setCustomPoints] = useState(75);
  const [customLabel, setCustomLabel] = useState("Custom Practice");
  const [activityDetails, setActivityDetails] = useState("");
  const [customCategories, setCustomCategories] = useState<CustomPointCategory[]>([]);
  const [customCategoryId, setCustomCategoryId] = useState<number | undefined>();
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidenceLink, setEvidenceLink] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  const calculatedPoints = useMemo(
    () => calculateActivityPoints({ activityType, minutes, quantity, customPoints }),
    [activityType, customPoints, minutes, quantity]
  );
  const selectedCategory = customCategories.find((category) => category.id === customCategoryId);
  const points =
    activityType === "custom_activity" && selectedCategory
      ? Math.min(calculatedPoints, selectedCategory.maxPoints)
      : calculatedPoints;

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/admin/custom-categories", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; categories?: CustomPointCategory[]; error?: string }
          | null;
        if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Could not load point categories.");
        if (cancelled) return;
        const categories = payload.categories ?? [];
        setCustomCategories(categories);
        const first = categories[0];
        if (first) {
          setCustomCategoryId(first.id);
          setCustomLabel(first.name);
          setCustomPoints(first.defaultPoints);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setCategoryLoadError(caught instanceof Error ? caught.message : "Could not load point categories.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function chooseCustomCategory(value: string) {
    if (value === "other") {
      setCustomCategoryId(undefined);
      setCustomLabel("Custom Practice");
      setCustomPoints(75);
      return;
    }

    const category = customCategories.find((entry) => entry.id === Number(value));
    if (!category) return;
    setCustomCategoryId(category.id);
    setCustomLabel(category.name);
    setCustomPoints(category.defaultPoints);
  }

  function addEvidenceFiles(selectedFiles: FileList | null) {
    if (!selectedFiles) return;
    const next = [...evidenceFiles];
    for (const file of Array.from(selectedFiles)) {
      const duplicate = next.some((entry) => entry.name === file.name && entry.size === file.size && entry.lastModified === file.lastModified);
      if (!duplicate) next.push(file);
    }
    if (next.length > MAX_POINT_EVIDENCE_FILES) {
      setMessage(`You can attach up to ${MAX_POINT_EVIDENCE_FILES} files.`);
      if (evidenceInputRef.current) evidenceInputRef.current.value = "";
      return;
    }
    const unsupported = next.find((file) => !normalizeEvidenceMimeType(file.name, file.type));
    if (unsupported) {
      setMessage(`${unsupported.name} is not a supported image, audio, video, or PDF file.`);
      if (evidenceInputRef.current) evidenceInputRef.current.value = "";
      return;
    }
    const tooLarge = next.find((file) => file.size <= 0 || file.size > MAX_POINT_EVIDENCE_FILE_BYTES);
    if (tooLarge) {
      setMessage(`${tooLarge.name} must be 15 MB or smaller.`);
      if (evidenceInputRef.current) evidenceInputRef.current.value = "";
      return;
    }
    if (next.reduce((total, file) => total + file.size, 0) > MAX_POINT_EVIDENCE_TOTAL_BYTES) {
      setMessage("Evidence files can total no more than 50 MB.");
      if (evidenceInputRef.current) evidenceInputRef.current.value = "";
      return;
    }
    setEvidenceFiles(next);
    setMessage(null);
    if (evidenceInputRef.current) evidenceInputRef.current.value = "";
  }

  async function cleanUpUploads(paths: string[]) {
    if (paths.length === 0) return;
    await fetch("/api/points/evidence", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths })
    }).catch(() => undefined);
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      let uploadTickets: EvidenceUploadTicket[] = [];
      try {
        if (evidenceLink.trim() && !normalizeGoogleDriveUrl(evidenceLink)) {
          throw new Error("Enter a valid Google Drive or Google Docs sharing link.");
        }

        if (evidenceFiles.length > 0) {
          const ticketResponse = await fetch("/api/points/evidence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              files: evidenceFiles.map((file) => ({
                name: file.name,
                mimeType: normalizeEvidenceMimeType(file.name, file.type),
                sizeBytes: file.size
              }))
            })
          });
          const ticketPayload = (await ticketResponse.json()) as {
            ok?: boolean;
            bucket?: string;
            uploads?: EvidenceUploadTicket[];
            error?: string;
          };
          if (!ticketResponse.ok || !ticketPayload.ok || !ticketPayload.bucket || ticketPayload.uploads?.length !== evidenceFiles.length) {
            throw new Error(ticketPayload.error ?? "Could not prepare evidence uploads.");
          }

          uploadTickets = ticketPayload.uploads;
          const supabase = getSupabaseBrowserClient();
          if (!supabase) throw new Error("Evidence uploads are not configured for this deployment.");
          const uploads = await Promise.allSettled(uploadTickets.map(async (ticket, index) => {
            const { error } = await supabase.storage
              .from(ticketPayload.bucket!)
              .uploadToSignedUrl(ticket.storagePath, ticket.token, evidenceFiles[index], {
                contentType: ticket.mimeType,
                cacheControl: "3600"
              });
            if (error) throw error;
          }));
          const failedUpload = uploads.find((result) => result.status === "rejected");
          if (failedUpload?.status === "rejected") {
            throw new Error(failedUpload.reason instanceof Error ? failedUpload.reason.message : "An evidence file could not be uploaded.");
          }
        }

        const response = await fetch("/api/points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: currentUser.id,
            activityType,
            minutes,
            quantity,
            customPoints,
            customLabel: activityType === "custom_activity" ? customLabel : undefined,
            customCategoryId: activityType === "custom_activity" ? customCategoryId : undefined,
            activityDetails: activityType === "custom_activity" ? activityDetails.trim() : undefined,
            evidenceFiles: uploadTickets.map((ticket) => ({
              id: ticket.id,
              name: ticket.name,
              mimeType: ticket.mimeType,
              sizeBytes: ticket.sizeBytes,
              storagePath: ticket.storagePath
            })),
            evidenceLink: evidenceLink.trim() || undefined
          })
        });

        const payload = (await response.json()) as { ok: boolean; message?: string; error?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Could not submit point log.");
        }
        setMessage(`${payload.message ?? payload.error ?? "Point log submitted."} View it in your submission history.`);
        setEvidenceFiles([]);
        setEvidenceLink("");
        setActivityDetails("");
        if (evidenceInputRef.current) evidenceInputRef.current.value = "";
        router.refresh();
      } catch (caught) {
        await cleanUpUploads(uploadTickets.map((ticket) => ticket.storagePath));
        setMessage(caught instanceof Error ? caught.message : "Could not submit point log.");
      }
    });
  }

  return (
    <details open className="group/disclosure min-w-0 overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm" aria-labelledby="log-practice-heading">
      <summary className="flex min-h-20 cursor-pointer list-none items-start justify-between gap-3 p-4 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400">
        <div className="min-w-0 flex-1">
          <h2 id="log-practice-heading" className="text-lg font-semibold text-white">Log practice</h2>
          <p className="mt-1 text-sm leading-5 text-zinc-500">Your entry will be sent to an officer for approval.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-right">
            <div className="text-xs font-medium text-cyan-300">If approved</div>
            <div className="text-xl font-semibold tabular-nums text-white">{formatNumber(points)}</div>
          </div>
          <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform duration-200 group-open/disclosure:rotate-180" aria-hidden="true" />
        </div>
      </summary>

      <div className="grid gap-3 border-t border-court-line p-4">
        <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
          Activity type
          <select
            value={activityType}
            onChange={(event) => setActivityType(event.target.value as ActivityType)}
            className="h-11 w-full min-w-0 max-w-full rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
          >
            {activityTypes.map((type) => (
              <option key={type} value={type}>
                {activityLabels[type]}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal leading-5 text-zinc-500">{activityHelp[activityType]}</span>
        </label>

        {(activityType === "solo_study" || activityType === "partner_study" || activityType === "build_testing") && (
          <label className="grid gap-2 text-sm font-medium text-zinc-600">
            Time spent (minutes)
            <input
              type="number"
              min={0}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
            />
          </label>
        )}

        {activityType === "id_specimens" ? (
          <label className="grid gap-2 text-sm font-medium text-zinc-600">
            Quantity
            <input
              type="number"
              min={0}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
            />
          </label>
        ) : null}

        {activityType === "custom_activity" ? (
          <>
            <label className="grid gap-2 text-sm font-medium text-zinc-600">
              Point Category
              <select
                value={customCategoryId ?? "other"}
                onChange={(event) => chooseCustomCategory(event.target.value)}
                className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
              >
                {customCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value="other">Other / one-time activity</option>
              </select>
            </label>
            {selectedCategory ? (
              <div className="rounded-md bg-court-elevated p-3 text-xs text-zinc-500">
                Default {selectedCategory.defaultPoints} points · maximum {selectedCategory.maxPoints} points
              </div>
            ) : (
              <label className="grid gap-2 text-sm font-medium text-zinc-600">
                Category Name
                <input
                  value={customLabel}
                  onChange={(event) => setCustomLabel(event.target.value)}
                  className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
                />
              </label>
            )}
            {categoryLoadError ? <div className="text-xs text-amber-200">{categoryLoadError}</div> : null}
            <label className="grid gap-2 text-sm font-medium text-zinc-600">
              What did you do?
              <textarea
                value={activityDetails}
                onChange={(event) => setActivityDetails(event.target.value)}
                maxLength={500}
                rows={3}
                required
                placeholder="Describe the work so an officer can review it."
                className="rounded-md border border-court-line bg-court-panel p-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400"
              />
              <span className="text-xs font-normal text-zinc-500">This description appears in the approval queue.</span>
            </label>
          </>
        ) : null}

        {activityType === "build_testing" || activityType === "custom_activity" ? (
          <label className="grid gap-2 text-sm font-medium text-zinc-600">
            Requested points
            <input
              type="number"
              min={0}
              max={activityType === "custom_activity" ? selectedCategory?.maxPoints ?? 500 : 200}
              value={customPoints}
              onChange={(event) => setCustomPoints(Number(event.target.value))}
              className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
            />
          </label>
        ) : null}

        <div className="rounded-md border border-court-line bg-court-elevated p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">Evidence <span className="font-normal text-zinc-500">(optional)</span></div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Attach up to 5 images, audio/video files, or PDFs. Each file can be up to 15 MB.</p>
            </div>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-court-line bg-court-panel px-3 text-xs font-semibold text-zinc-600 transition hover:border-cyan-400 hover:text-white">
              <Paperclip className="h-4 w-4" aria-hidden="true" />
              Add files
              <input
                ref={evidenceInputRef}
                type="file"
                multiple
                accept={POINT_EVIDENCE_MIME_TYPES.join(",")}
                onChange={(event) => addEvidenceFiles(event.target.files)}
                className="sr-only"
              />
            </label>
          </div>

          {evidenceFiles.length > 0 ? (
            <ul className="mt-3 space-y-2" aria-label="Selected evidence files">
              {evidenceFiles.map((file, index) => (
                <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-w-0 items-center gap-2 rounded-md bg-court-panel px-3 py-2 text-xs">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-zinc-600">{file.name}</span>
                  <span className="shrink-0 text-zinc-500">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => setEvidenceFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-court-elevated hover:text-white"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <label className="mt-3 grid gap-2 text-xs font-medium text-zinc-600">
            <span className="inline-flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" aria-hidden="true" /> Google Drive link</span>
            <input
              type="url"
              inputMode="url"
              value={evidenceLink}
              onChange={(event) => setEvidenceLink(event.target.value)}
              placeholder="https://drive.google.com/..."
              className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400"
            />
            <span className="font-normal leading-5 text-zinc-500">Use a sharing link that your officers can open.</span>
          </label>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={isPending || points <= 0 || (activityType === "custom_activity" && !activityDetails.trim())}
          className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-200 disabled:border disabled:border-court-line disabled:bg-court-elevated disabled:text-zinc-500 disabled:opacity-100"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PlusCircle className="h-4 w-4" aria-hidden="true" />}
          Send for approval
        </button>

        {message ? <div className="rounded-md bg-court-elevated p-3 text-sm text-zinc-600" role="status">{message}</div> : null}
      </div>
    </details>
  );
}
