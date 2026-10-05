"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  ImageOff,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { getErrorMessage } from "./helpers";

// An employee's files, on the profile's Attachments tab.
//
// Photographs are shown as pictures, since a scanned licence or a medical
// slip is read by looking at it; PDFs and Word files as a list to open.

interface Attachment {
  attachmentID: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  url: string | null;
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.docx";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploaded(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function documentLabel(type: string) {
  if (type === "application/pdf") return "PDF";
  if (type.includes("wordprocessingml")) return "DOCX";
  return "File";
}

export function EmployeeAttachments({
  employeeID,
  canEdit,
}: {
  employeeID: string;
  canEdit: boolean;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      // Never from the cache: the links inside expire.
      const result = await apiFetch<{ data: Attachment[] }>(
        `/api/employees/${employeeID}/attachments`,
        { cache: "no-store" },
      );
      setAttachments(result.data ?? []);
      setState("ready");
    } catch (error) {
      setMessage(getErrorMessage(error));
      setState("error");
    }
  }, [employeeID]);

  useEffect(() => {
    // Set from the response, not in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    const body = new FormData();
    files.forEach((file) => body.append("files", file));

    setIsUploading(true);
    setMessage("");
    try {
      await apiFetch(`/api/employees/${employeeID}/attachments`, { method: "POST", body });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      // Some of a batch may have gone in even when the rest failed.
      await load();
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setMessage("");
    try {
      await apiFetch(`/api/employees/${employeeID}/attachments/${pendingDelete.attachmentID}`, {
        method: "DELETE",
      });
      setAttachments((current) =>
        current.filter((item) => item.attachmentID !== pendingDelete.attachmentID),
      );
      setPendingDelete(null);
    } catch (error) {
      setMessage(getErrorMessage(error));
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const images = attachments.filter((item) => item.fileType.startsWith("image/"));
  const documents = attachments.filter((item) => !item.fileType.startsWith("image/"));

  const deleteButton = (item: Attachment, className: string) =>
    canEdit && (
      <button
        type="button"
        onClick={() => setPendingDelete(item)}
        className={`min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 ${className}`}
        title={`Remove ${item.fileName}`}
        aria-label={`Remove ${item.fileName}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );

  return (
    <div className="space-y-4 text-sm text-slate-900">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-blue-600" />
          <h2 className="font-semibold text-black">Employee Attachments</h2>
          {state === "ready" && attachments.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {attachments.length}
            </span>
          )}
        </div>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => void upload(Array.from(event.target.files ?? []))}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading || state === "loading"}
              className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isUploading ? "Uploading..." : "Add Files"}
            </button>
          </>
        )}
      </div>

      {message && state !== "error" && (
        <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </p>
      )}

      {state === "loading" && (
        <div className="flex min-h-48 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading attachments...
        </div>
      )}

      {state === "error" && (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{message || "Could not load the attachments."}</p>
          <button
            type="button"
            onClick={() => {
              setState("loading");
              void load();
            }}
            className="min-h-tap md:pointer-fine:min-h-0 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50"
          >
            Try again
          </button>
        </div>
      )}

      {state === "ready" && attachments.length === 0 && (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <Paperclip className="h-5 w-5" />
          </div>
          <p className="font-semibold text-slate-900">No attachments yet</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-600">
            {canEdit
              ? "Add certificates, medical results or IDs: PDF, JPG, PNG, WEBP or DOCX, up to 10 MB each."
              : "Certificates, medical results and IDs added by an admin appear here."}
          </p>
        </div>
      )}

      {/* PHOTOS */}
      {state === "ready" && images.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-semibold text-black">
            Photos <span className="font-normal text-slate-500">({images.length})</span>
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((item) => (
              <figure
                key={item.attachmentID}
                className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                <button
                  type="button"
                  onClick={() => item.url && setPreview(item)}
                  disabled={!item.url}
                  className="relative block aspect-square w-full overflow-hidden bg-slate-100"
                  aria-label={`View ${item.fileName}`}
                >
                  {item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a signed, expiring URL; nothing to optimise
                    <img
                      src={item.url}
                      alt={item.fileName}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-slate-500">
                      <ImageOff className="h-5 w-5" /> Unavailable
                    </span>
                  )}
                </button>
                <figcaption className="flex items-start gap-1 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800" title={item.fileName}>
                      {item.fileName}
                    </p>
                    <p className="text-xs sm:text-[10px] text-slate-500">
                      {formatSize(item.fileSize)} · {formatUploaded(item.uploadedAt)}
                    </p>
                  </div>
                  {deleteButton(item, "-mr-1 -mt-1 p-1.5")}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* DOCUMENTS */}
      {state === "ready" && documents.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-semibold text-black">
            Documents <span className="font-normal text-slate-500">({documents.length})</span>
          </h3>
          <ul className="divide-y divide-slate-100">
            {documents.map((item) => (
              <li key={item.attachmentID} className="flex items-center gap-3 py-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800" title={item.fileName}>
                    {item.fileName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {documentLabel(item.fileType)} · {formatSize(item.fileSize)} · {formatUploaded(item.uploadedAt)}
                  </p>
                </div>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    aria-label={`Open ${item.fileName}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Open</span>
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-slate-500">Unavailable</span>
                )}
                {deleteButton(item, "shrink-0 p-2")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* PHOTO VIEWER */}
      {preview?.url && (
        <div
          className="fixed inset-0 z-70 flex flex-col bg-slate-950/90 p-4 animate-fade-in"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label={preview.fileName}
        >
          <div
            className="mb-3 flex items-center gap-2 text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{preview.fileName}</p>
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              download={preview.fileName}
              className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center rounded-lg p-2 hover:bg-white/10"
              title="Open full size"
              aria-label="Open full size"
            >
              <Download className="h-5 w-5" />
            </a>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center rounded-lg p-2 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed, expiring URL */}
            <img
              src={preview.url}
              alt={preview.fileName}
              onClick={(event) => event.stopPropagation()}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {pendingDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900">Remove Attachment</h3>
            <p className="mb-6 text-sm text-slate-600 wrap-break-word">
              Remove <strong className="text-slate-900">{pendingDelete.fileName}</strong>? It cannot be
              recovered.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={isDeleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
