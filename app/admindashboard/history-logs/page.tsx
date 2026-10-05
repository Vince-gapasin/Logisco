"use client";

// The mechanics' maintenance history, for the office: every truck's repairs,
// including the trucks that have since been deleted, which no other office
// screen shows.
import HistoryLogsScreen from "@/app/mechanic/history-logs/_components/HistoryLogsScreen";

export default function OfficeHistoryLogsPage() {
  return <HistoryLogsScreen office />;
}
