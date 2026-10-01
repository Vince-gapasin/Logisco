"use client";

import React from "react";

// Placeholder rows shown while a table loads, so the page keeps its shape
// instead of collapsing to a spinner and then jumping when data arrives.
export default function TableSkeleton({
  rows = 5,
  columns,
  // Set on tables whose rows become cards on a phone, so the placeholder
  // stacks the same way and the layout does not jump when data arrives.
  stacked = false,
}: {
  rows?: number;
  columns: number;
  stacked?: boolean;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr
          key={rowIndex}
          // Stacked rows sit in a table whose display is overridden, which drops
          // the implicit roles - so these name theirs the way the real rows do.
          role={stacked ? "row" : undefined}
          className={
            stacked
              ? "block md:table-row bg-white border border-slate-200 rounded-xl mb-4 p-3 md:border-0 md:border-b md:border-slate-100 md:rounded-none md:mb-0 md:p-0"
              : "border-b border-slate-100"
          }
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <td
              key={columnIndex}
              role={stacked ? "cell" : undefined}
              className={`py-4 px-4 sm:px-6 ${stacked ? "block md:table-cell py-1.5 md:py-4 px-0 md:px-4" : ""}`}
            >
              <div
                className="h-3.5 rounded bg-slate-100 animate-pulse"
                // Varying widths read as text rather than a solid block.
                style={{ width: columnIndex === 0 ? "60%" : columnIndex % 2 ? "45%" : "70%" }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
