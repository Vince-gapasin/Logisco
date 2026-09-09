"use client";
import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, ArrowLeft } from "lucide-react";

export default function CompletedFeedPage() {
  const [records] = useState<any[]>([]);

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Link
            href="/admindashboard/dashboard"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors inline-flex items-center justify-center shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-500 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Completed Feed
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Review successfully delivered orders and trip history.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        {records.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12 mb-2 opacity-20" />
            <p className="font-semibold text-slate-600 text-base">
              No Completed Records Found
            </p>
            <p className="text-xs text-slate-400 mt-1">
              There are currently no records available in this feed.
            </p>
          </div>
        ) : (
          <div>{/* Future record mapping */}</div>
        )}
      </div>
    </div>
  );
}
