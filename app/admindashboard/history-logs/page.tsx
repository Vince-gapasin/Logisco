"use client";

// The mechanics' maintenance history, for the office: every truck's repairs,
// including the trucks that have since been deleted, which no other office
// screen shows.
import HistoryLogsScreen from "@/app/mechanic/history-logs/_components/HistoryLogsScreen";
import PhotoCheckBanner from "@/components/PhotoCheckBanner";

export default function OfficeHistoryLogsPage() {
  return (
    <>
      {/* While the mechanic photo check is relaxed, said above the logs it affects. */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 empty:hidden">
        <PhotoCheckBanner check="repairPhotoCheck" />
      </div>
      <HistoryLogsScreen office />
    </>
  );
}
