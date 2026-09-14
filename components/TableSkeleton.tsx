"use client";

import React from "react";

// Placeholder rows shown while a table loads, so the page keeps its shape
// instead of collapsing to a spinner and then jumping when data arrives.
export default function TableSkeleton({
  rows = 5,
  columns,
}: {
  rows?: number;
  columns: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-slate-100">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <td key={columnIndex} className="py-4 px-4 sm:px-6">
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
