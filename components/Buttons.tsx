// File: components/buttons.tsx
"use client";

import React from "react";

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function PrimaryActionButton({
  icon,
  children,
  className = "",
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={`w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap cursor-pointer ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
