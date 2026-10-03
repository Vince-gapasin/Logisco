"use client";

import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useSessionUser } from "@/app/lib/useSessionUser";

// The office portal's admin-only screens, as a coordinator sees them.
//
// Admin and coordinator share the portal, and a few of its screens are the
// admin's alone - the server refuses anyone else. Opened by a coordinator, they
// used to load and then show the raw refusal ("This action needs one of these
// roles: Admin...") over an empty page. This says it plainly instead.
export default function AdminOnly({ title, children }: { title: string; children: ReactNode }) {
  const user = useSessionUser();

  // Not known yet: render nothing rather than flash either version.
  if (!user) return null;
  if (user.role === "Admin") return <>{children}</>;

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-3xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-slate-400" />
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">This screen is for admins. Ask an admin if you need something from it.</p>
      </div>
    </div>
  );
}
