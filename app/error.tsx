"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

// Fallback for unexpected runtime errors in any page, so one failing screen
// shows a recoverable message instead of a blank app.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xl"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This page ran into an unexpected problem. You can try again, or go back to your dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-black"
          >
            Try again
          </button>
          <Link
            href="/login"
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
