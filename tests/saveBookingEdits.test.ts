import { beforeEach, describe, expect, it, vi } from "vitest";

// The edit windows' save, and the one question it can come back with.

// Hoisted with the mock, so the class the module checks against is this one.
const { ApiError, apiFetch } = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(message: string, status: number, body: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return { ApiError, apiFetch: vi.fn() };
});
vi.mock("@/app/lib/apiClient", () => ({ ApiError, apiFetch }));

const { saveBookingEdits } = await import("@/app/lib/saveBookingEdits");

beforeEach(() => {
  apiFetch.mockReset();
});

describe("saving an edit window's changes", () => {
  it("sends nothing when nothing changed", async () => {
    expect(await saveBookingEdits("b1", null)).toEqual({ saved: true });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("hands back the question when moving to today needs asking, instead of failing", async () => {
    apiFetch.mockImplementation(async () => {
      throw new ApiError("Nothing to spare.", 409, { needsConfirmation: "tightSchedule" });
    });
    expect(await saveBookingEdits("b1", { deliverySchedule: "2026-10-09" })).toEqual({ saved: false, question: "Nothing to spare." });
  });

  it("sends the choice to keep today on the second try", async () => {
    apiFetch.mockResolvedValue({});
    await saveBookingEdits("b1", { deliverySchedule: "2026-10-09" }, true);
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({
      action: "update",
      deliverySchedule: "2026-10-09",
      acknowledgeTightSchedule: true,
    });
  });

  it("does not mistake another refusal for the question", async () => {
    apiFetch.mockImplementation(async () => {
      throw new ApiError("This delivery is already on the road.", 409, { message: "on the road" });
    });
    await expect(saveBookingEdits("b1", { deliverySchedule: "2026-10-09" })).rejects.toThrow(/already on the road/);
  });
});
