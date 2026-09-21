"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface UrlSearchSyncProps {
  /** Receives the ?q= value - normally the page's own setSearchTerm. */
  onQuery: (query: string) => void;
}

// Lets the header search land on a list with that list's own filter set.
//
// It hands ?q= to the page once and then removes it from the address bar.
// Leaving it there would re-apply the old search whenever the list remounted -
// coming back from a detail view, say - over whatever had been typed since.
// Removing it also means searching the same thing twice still works, because
// the second search changes the URL again.
function Sync({ onQuery }: UrlSearchSyncProps) {
  const params = useSearchParams();
  const pathname = usePathname();
  const query = params.get("q");

  // The latest callback, read through a ref so that a caller passing an
  // inline function - a new identity every render - cannot make the search
  // apply twice before the address bar change has come back round.
  const onQueryRef = useRef(onQuery);
  useEffect(() => {
    onQueryRef.current = onQuery;
  });

  useEffect(() => {
    if (query === null) return;
    onQueryRef.current(query);

    const rest = new URLSearchParams(params.toString());
    rest.delete("q");
    const remaining = rest.toString();
    // Native replaceState is integrated with the Next router in this version,
    // so useSearchParams sees the change without a navigation round trip.
    window.history.replaceState(null, "", remaining ? `${pathname}?${remaining}` : pathname);
  }, [query, params, pathname]);

  return null;
}

// useSearchParams makes everything above the nearest Suspense boundary render
// on the client. This boundary wraps only a component that renders nothing,
// so the page around it stays prerendered.
export default function UrlSearchSync(props: UrlSearchSyncProps) {
  return (
    <Suspense fallback={null}>
      <Sync {...props} />
    </Suspense>
  );
}
