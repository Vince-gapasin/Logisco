"use client";

import { useEffect, useState } from "react";
import SharedProfile from "@/components/SharedProfile";
import PerformancePanel from "@/components/employee/PerformancePanel";
import { readStoredSession } from "@/app/lib/clientSession";

// A driver's own record, on their own profile.
//
// The same screen their supervisor sees, with the same weights and the same
// counts. A rating somebody is judged by but cannot look at is a rumour, and
// arguing with a rumour is impossible - which is exactly when a crew decides
// the whole system is rigged against them. So they see all of it, including the
// delays the office excused on their behalf.

export default function CrewProfilePage() {
  const [employeeID, setEmployeeID] = useState<string | null>(null);

  useEffect(() => {
    // Read from the stored session, which is only available in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmployeeID(readStoredSession()?.id ?? null);
  }, []);

  return (
    <>
      <SharedProfile />

      {employeeID && (
        <div className="p-4 sm:p-6 md:p-8 pt-0 w-full max-w-7xl mx-auto bg-slate-50">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 sm:p-6 md:p-8 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">My delivery record</h3>
              <p className="text-xs text-slate-500 mt-1">
                What your supervisor sees, exactly as they see it.
              </p>
            </div>
            <div className="p-5 sm:p-6 md:p-8">
              <PerformancePanel employeeID={employeeID} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
