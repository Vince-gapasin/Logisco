"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * What the app says back when something worked, or did not.
 *
 * This replaces window.alert, which twenty-three call sites were using. In a
 * Capacitor WebView that renders the Android system dialog, captioned
 * "logisco-system.vercel.app says" - unbranded, leaking the deployment URL into
 * the UI, blocking the JS thread, and not dismissible by tapping outside it. The
 * crew dashboard had twelve of them, on the screen a driver uses one-handed in a
 * moving truck.
 *
 * The look is the toast the app already had on the history and dashboard
 * screens, lifted out so there is one of them: a dark pill, centred at the
 * bottom on a phone and tucked to the right from sm up.
 *
 * A provider rather than local state because the call sites are spread across
 * components inside the same file - a page and the modals it renders - and
 * threading a setter through three thousand lines to reach a modal's catch block
 * is how a catch block ends up silent.
 */

export type ToastTone = "success" | "error" | "info";

type Toast = { message: string; tone: ToastTone; id: number };

// A success can go on its own; nobody needs to confirm that a thing worked. A
// failure gets longer, because the reason a driver did not see it is usually
// that they were looking at the road.
//
// It still goes, though. Errors here are often validation - a missing receiver
// name - and a toast that waits to be dismissed is a toast sitting over the
// field the message is asking you to fill. Seven seconds, a dismiss button, and
// role="alert" so a screen reader says it whether or not it is still on screen.
const AUTO_DISMISS_MS: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  error: 7000,
};

type ShowToast = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ShowToast | null>(null);

/**
 * Shows a message. Falls back to alert() when no provider is mounted rather than
 * throwing or doing nothing: a screen outside the portals is a mistake worth
 * fixing, but losing the message entirely is worse than the old dialog.
 */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  return useCallback(
    (message, tone = "success") => {
      if (show) {
        show(message, tone);
        return;
      }
      if (typeof window !== "undefined") {
        console.warn("useToast called with no ToastProvider above it");
        window.alert(message);
      }
    },
    [show],
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const show = useCallback<ShowToast>(
    (message, tone = "success") => {
      clearTimer();
      // The id restarts the enter animation when one message replaces another,
      // so two failures in a row do not look like one that never left.
      setToast({ message, tone, id: Date.now() });
      const ms = AUTO_DISMISS_MS[tone];
      if (ms) {
        timer.current = setTimeout(() => setToast(null), ms);
      }
    },
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          key={toast.id}
          // A failure interrupts; a confirmation waits its turn. This is the
          // part alert() supplied for free and the reason not to just drop it.
          role={toast.tone === "error" ? "alert" : "status"}
          aria-live={toast.tone === "error" ? "assertive" : "polite"}
          className="fixed bottom-[calc(1.5rem+var(--safe-bottom)+var(--bottom-nav))] left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-100 w-[calc(100vw-2rem)] max-w-sm sm:w-auto animate-in fade-in slide-in-from-bottom-5"
        >
          <div className="bg-slate-900 text-white pl-5 pr-2 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-slate-700">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                toast.tone === "error"
                  ? "bg-red-500"
                  : toast.tone === "info"
                    ? "bg-blue-500"
                    : "bg-emerald-500"
              }`}
            >
              {toast.tone === "success" ? (
                <svg
                  className="w-3.5 h-3.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-3.5 h-3.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>
            {/* wrap-break-word because these carry server messages, which are
                not written to a length. */}
            <span className="flex-1 wrap-break-word">{toast.message}</span>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              // Full 48dp, because on an error this is the only way out.
              className="shrink-0 min-w-tap min-h-tap -my-3 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
