"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CornerDownLeft,
  Loader2,
  Package,
  Search,
  Truck,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { authFetch } from "@/app/lib/apiClient";
import type { SearchResult, SearchResultType } from "@/services/search/searchService";

// Mirrors MIN_QUERY_LENGTH in the search service. Not imported from it: that
// module pulls in the server Supabase client.
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

const GROUPS: Record<SearchResultType, { label: string; icon: LucideIcon }> = {
  client: { label: "Clients", icon: Building2 },
  employee: { label: "Employees", icon: User },
  truck: { label: "Trucks", icon: Truck },
  booking: { label: "Bookings", icon: Package },
  delivery: { label: "Your deliveries", icon: Package },
};

const PLACEHOLDERS: Record<string, string> = {
  "/crew": "Search deliveries…",
  "/mechanic": "Search trucks…",
};

interface Response {
  /** The text that was sent, so a late reply to an old query is never shown. */
  requested: string;
  results: SearchResult[];
  failed: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

// Bolds the part of a result that matches what was typed. A plain indexOf
// rather than a RegExp, so nothing typed can be read as a pattern.
function Highlight({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-amber-100 text-inherit rounded-sm px-0.5 -mx-0.5">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

export default function GlobalSearch({ basePath }: { basePath: string }) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<Response | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const trimmed = query.trim();
  const searchable = trimmed.length >= MIN_QUERY_LENGTH;

  // Only a reply to what is in the box right now counts. Anything else is a
  // reply to an earlier keystroke and is treated as still loading.
  const current = response && response.requested === trimmed ? response : null;
  const results = useMemo(() => current?.results ?? [], [current]);
  const loading = searchable && !current;

  // Debounced, and each new keystroke aborts the request before it.
  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await authFetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Search returned ${res.status}`);
        const body = (await res.json()) as { results?: SearchResult[] };
        const found = body.results ?? [];
        setResponse({ requested: trimmed, results: found, failed: false });
        // The top result is pre-selected, so Enter opens it.
        setActive(found.length > 0 ? 0 : -1);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setResponse({ requested: trimmed, results: [], failed: true });
        setActive(-1);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searchable]);

  // "/" or Ctrl/Cmd+K focuses the box from anywhere, unless you are already
  // typing somewhere else.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const slash = event.key === "/" && !isTypingTarget(event.target);
      const commandK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!slash && !commandK) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Clicking or tapping anywhere else closes the results.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  // Keep the highlighted result in view while arrowing through a long list.
  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const clear = useCallback(() => {
    setQuery("");
    setActive(-1);
    inputRef.current?.focus();
  }, []);

  const go = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery("");
      setActive(-1);
      inputRef.current?.blur();
      router.push(result.href);
    },
    [router],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        if (results.length > 0) setActive((i) => (i + 1) % results.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (results.length > 0) setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
        break;
      case "Enter":
        if (active >= 0 && results[active]) {
          event.preventDefault();
          go(results[active]);
        }
        break;
      case "Escape":
        // First Escape closes the list, the second clears, the third leaves.
        if (open && trimmed) setOpen(false);
        else if (query) setQuery("");
        else inputRef.current?.blur();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const showPanel = open && trimmed.length > 0;
  const activeId = showPanel && active >= 0 ? `${listId}-${active}` : undefined;

  let message: React.ReactNode = null;
  if (!searchable) message = `Type at least ${MIN_QUERY_LENGTH} characters to search.`;
  else if (loading)
    message = (
      <span className="inline-flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Searching…
      </span>
    );
  else if (current?.failed) message = "Search is unavailable right now. Try again in a moment.";
  else if (results.length === 0) message = `No results for “${trimmed}”.`;

  return (
    <div ref={rootRef} className="relative w-full min-w-0 max-w-50 sm:max-w-xs md:max-w-md">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={PLACEHOLDERS[basePath] ?? "Search bookings, clients…"}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full bg-gray-100/80 text-xs md:text-sm text-gray-700 rounded-full pl-9 md:pl-10 pr-10 py-2 md:py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white"
      />

      {query ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-0 sm:right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200/70"
        >
          <X className="w-4 h-4" />
        </button>
      ) : (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex items-center rounded border border-gray-300 bg-white px-1.5 text-[11px] font-medium text-gray-400"
        >
          /
        </kbd>
      )}

      {showPanel && (
        // Full width under the header on a phone, where the box itself is
        // only about 156px wide; anchored under the box from sm up.
        <div className="fixed inset-x-0 top-16 z-50 px-2 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:px-0 sm:w-[28rem] sm:max-w-[calc(100vw-2rem)]">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <ul id={listId} role="listbox" aria-label="Search results" className="max-h-[70dvh] overflow-y-auto py-1">
              {results.map((result, index) => {
                const group = GROUPS[result.type];
                const Icon = group.icon;
                const startsGroup = index === 0 || results[index - 1].type !== result.type;
                const selected = index === active;
                return (
                  <React.Fragment key={result.id}>
                    {startsGroup && (
                      <li
                        role="presentation"
                        className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                      >
                        {group.label}
                      </li>
                    )}
                    <li
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={selected}
                      // mousedown would blur the input before the click lands.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => go(result)}
                      onMouseMove={() => active !== index && setActive(index)}
                      className={`mx-1 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 ${
                        selected ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          <Highlight text={result.title} query={trimmed} />
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          <Highlight text={result.subtitle} query={trimmed} />
                        </span>
                      </span>
                      {selected && (
                        <CornerDownLeft aria-hidden className="hidden sm:block w-4 h-4 shrink-0 text-slate-400" />
                      )}
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>

            {message && (
              <div role="status" className="px-4 py-3 text-sm text-slate-500">
                {message}
              </div>
            )}

            {results.length > 0 && (
              <div className="hidden sm:flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">
                <span>↑↓ to move</span>
                <span>Enter to open</span>
                <span>Esc to close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
