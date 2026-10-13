import { beforeEach, describe, expect, it, vi } from "vitest";

// A client reporting a problem from the tracking page, and the office
// resolving it.
//
// Feedback only appeared once a delivery was finished, so a client with a late
// truck or a rude crew had nowhere to say so but the phone. A report can be
// sent at any stage, the office is told, and their reply goes back to the
// client - but one link cannot bury the office, and a report is not resolved
// without saying how.

const TOKEN = "11111111-2222-4333-8444-555555555555";

let order: Record<string, unknown> | null;
let todaysCount: number;
let current: Record<string, unknown> | null;
let updated: Record<string, unknown> | null;
const inserts: Record<string, unknown>[] = [];
const updates: Record<string, unknown>[] = [];
const conditions: string[] = [];
const notified: Record<string, unknown>[] = [];

vi.mock("@/app/lib/supabase", () => {
  const chain = (table: string) => {
    let counting = false;
    const self: Record<string, unknown> = {
      select: (_columns: string, options?: { head?: boolean }) => {
        if (options?.head) counting = true;
        return self;
      },
      insert: (payload: Record<string, unknown>) => {
        inserts.push(payload);
        return self;
      },
      update: (payload: Record<string, unknown>) => {
        updates.push(payload);
        return self;
      },
      eq: (column: string, value: unknown) => {
        conditions.push(`${column}=${value}`);
        return self;
      },
      gte: () => self,
      // A count query is awaited straight after its filters.
      then: (resolve: (value: unknown) => void) =>
        resolve(counting ? { count: todaysCount, error: null } : { data: [], error: null }),
      single: async () => ({
        data: {
          reportID: "report-1",
          createdAt: "2026-10-13T08:00:00Z",
          status: "open",
          resolvedAt: null,
          resolutionNote: null,
          ...inserts[inserts.length - 1],
        },
        error: null,
      }),
      maybeSingle: async () => {
        if (table === "Order") return { data: order, error: null };
        return { data: updates.length ? updated : current, error: null };
      },
    };
    return self;
  };
  return { supabase: { from: chain } };
});
vi.mock("@/services/notifications/notify", () => ({
  OFFICE: ["admin", "coordinator"],
  notify: async (input: Record<string, unknown>) => {
    notified.push(input);
    return 1;
  },
}));

const { cleanReport, submitClientReport, resolveClientReport, ClientReportError, DAILY_REPORT_LIMIT } = await import(
  "@/services/feedback/clientReportService"
);

beforeEach(() => {
  order = {
    orderID: "order-1",
    orderCode: "ORD-1",
    isActive: true,
    Client: { company: "Acme" },
    DispatchOrder: [{ dispatchID: "trip-1", status: "In Transit" }],
  };
  todaysCount = 0;
  current = { reportID: "report-1", orderID: "order-1", status: "open", resolutionNote: null };
  updated = { reportID: "report-1" };
  inserts.length = 0;
  updates.length = 0;
  conditions.length = 0;
  notified.length = 0;
});

describe("what a client may send", () => {
  it("needs a category it knows", () => {
    expect(() => cleanReport({ category: "rude", message: "x" })).toThrow(ClientReportError);
  });

  it("needs to say what happened", () => {
    expect(() => cleanReport({ category: "late", message: "   " })).toThrow(ClientReportError);
  });

  it("trims what it keeps, and the contact is optional", () => {
    expect(cleanReport({ category: "late", message: "  Two hours late  ", contactBack: "  " })).toEqual({
      category: "late",
      message: "Two hours late",
      contactBack: null,
    });
  });
});

describe("sending a report", () => {
  it("works while the delivery is still on the road, and tells the office", async () => {
    const report = await submitClientReport(TOKEN, { category: "late", message: "Still waiting" });
    expect(report.status).toBe("open");
    expect(inserts[0]).toMatchObject({ orderID: "order-1", dispatchID: "trip-1", category: "late" });
    expect(notified[0]).toMatchObject({ event: "CLIENT_REPORT", severity: "action" });
    expect(String(notified[0].link)).toContain("report-1");
  });

  it("is refused on a cancelled booking", async () => {
    order = { ...order, isActive: false };
    await expect(submitClientReport(TOKEN, { category: "late", message: "x" })).rejects.toMatchObject({ status: 404 });
    expect(inserts).toHaveLength(0);
  });

  it("is capped per link per day", async () => {
    todaysCount = DAILY_REPORT_LIMIT;
    await expect(submitClientReport(TOKEN, { category: "other", message: "x" })).rejects.toMatchObject({ status: 429 });
    expect(inserts).toHaveLength(0);
  });
});

describe("resolving a report", () => {
  const resolve = (note: string, allowChange = false) =>
    resolveClientReport({ reportID: "report-1", note, resolverID: "emp-1", allowChange });

  it("needs a reply for the client", async () => {
    await expect(resolve("  ")).rejects.toBeInstanceOf(ClientReportError);
    expect(updates).toHaveLength(0);
  });

  it("records who resolved it and the reply", async () => {
    const result = await resolve(" Spoke to the crew ");
    expect(result.orderID).toBe("order-1");
    expect(updates[0]).toMatchObject({ status: "resolved", resolvedBy: "emp-1", resolutionNote: "Spoke to the crew" });
    expect(conditions).toContain("status=open");
  });

  it("does not resolve twice by accident", async () => {
    current = { ...current, status: "resolved" };
    await expect(resolve("again")).rejects.toMatchObject({ status: 409 });
  });

  it("tells the second of two people that someone beat them to it", async () => {
    updated = null;
    await expect(resolve("done")).rejects.toMatchObject({ status: 409 });
  });
});
