"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface UrlOpenSyncProps {
  /** The rows the list has loaded. Matched against ?open= by order ID. */
  rows: { orderId: string }[];
  /** False while the list is still loading, so a row is not missed. */
  ready: boolean;
  /** The list's own row handler - normally handleOpenModal. */
  onOpen: (row: never) => void;
}

// Opens one row's details straight away, named by ?open=ORD-123 in the address.
//
// The dashboard's feed cards used to open a summary of their own, so the same
// booking looked one way on the dashboard and another under View All. They now
// link here instead: one detail screen per list, opened from either place.
//
// The param is dropped once it has been used - the same way ?q= is - so that
// coming back to the list, or reloading it, does not reopen what was closed.
function Sync({ rows, ready, onOpen }: UrlOpenSyncProps) {
  const params = useSearchParams();
  const pathname = usePathname();
  const wanted = params.get("open");

  // Read through refs: the list re-renders on every poll, and neither a new
  // rows array nor an inline handler should count as a reason to open again.
  const onOpenRef = useRef(onOpen);
  const rowsRef = useRef(rows);
  useEffect(() => {
    onOpenRef.current = onOpen;
    rowsRef.current = rows;
  });

  // Opening is for the row that was clicked, once. Without this an order code
  // that matches nothing would keep the param, and the details would reopen
  // the moment the list refreshed.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!wanted || !ready || handled.current === wanted) return;
    handled.current = wanted;

    const row = rowsRef.current.find(
      (candidate) => candidate.orderId?.toUpperCase() === wanted.toUpperCase(),
    );
    // Not in this list: leave the coordinator on it rather than on nothing.
    if (row) onOpenRef.current(row as never);

    const rest = new URLSearchParams(params.toString());
    rest.delete("open");
    const remaining = rest.toString();
    window.history.replaceState(null, "", remaining ? `${pathname}?${remaining}` : pathname);
  }, [wanted, ready, params, pathname]);

  return null;
}

// useSearchParams makes everything above the nearest Suspense boundary render
// on the client. This one wraps a component that renders nothing, so the list
// around it stays prerendered.
export default function UrlOpenSync(props: UrlOpenSyncProps) {
  return (
    <Suspense fallback={null}>
      <Sync {...props} />
    </Suspense>
  );
}
