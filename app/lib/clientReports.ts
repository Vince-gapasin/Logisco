// What a client can report from their tracking page, in their words.
//
// Shared by the tracking page, the office's Client Reports screen and the
// server, so the three never disagree about what a category is called. The
// keys are what the database stores (see 20261013010000_client_reports.sql).

export const REPORT_CATEGORIES = [
  { key: "late", label: "Late or delayed" },
  { key: "damaged", label: "Damaged or missing goods" },
  { key: "crew", label: "Crew behaviour" },
  { key: "wrong_stop", label: "Wrong address or stop" },
  { key: "billing", label: "Billing or charges" },
  { key: "other", label: "Something else" },
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["key"];
export type ReportStatus = "open" | "resolved";

/** Long enough for a real complaint, short enough not to be a document. */
export const MAX_REPORT_MESSAGE = 2000;
export const MAX_CONTACT_BACK = 200;

export function isReportCategory(value: unknown): value is ReportCategory {
  return REPORT_CATEGORIES.some((category) => category.key === value);
}

export function reportCategoryLabel(key: string): string {
  return REPORT_CATEGORIES.find((category) => category.key === key)?.label ?? "Something else";
}

/** A report as the client sees it back on their tracking page. */
export interface ClientReportSummary {
  reportID: string;
  category: ReportCategory;
  message: string;
  createdAt: string;
  status: ReportStatus;
  resolvedAt: string | null;
  /** The office's reply. */
  resolutionNote: string | null;
}
