"use client";

import React from "react";

// Placeholder rows shown while a table loads, so the page keeps its shape
// instead of collapsing to a spinner and then jumping when data arrives.
export default function TableSkeleton({
  rows = 5,
  columns,
  // Set on tables whose rows are cards below desktop width (xl), so the placeholder
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
              ? "block xl:table-row bg-white border border-slate-200 rounded-xl mb-4 p-3 xl:border-0 xl:border-b xl:border-slate-100 xl:rounded-none xl:mb-0 xl:p-0"
              : "border-b border-slate-100"
          }
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <td
              key={columnIndex}
              role={stacked ? "cell" : undefined}
              className={`py-4 px-4 sm:px-6 ${stacked ? "block xl:table-cell py-1.5 xl:py-4 px-0 xl:px-4" : ""}`}
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
