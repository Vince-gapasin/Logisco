import { describe, expect, it } from "vitest";

import { readNote, readNotesBody, setNote, setNotesBody } from "@/app/lib/bookingNotes";

const blob = [
  "[DELIVERY DETAILS]",
  "Priority: Urgent",
  "Request Date: 2026-09-01",
  "Delivery Schedule: 2026-09-05",
  "Pickup: Pacific Harvest Main Office @ 08:00",
  "",
  "[SUBCON ASSIGNMENT]",
  "Partner: Batangas Haulers",
  "",
  "[NOTES]",
  "Handle with care",
].join("\n");

describe("editing a booking's notes", () => {
  it("reads a labelled line", () => {
    expect(readNote(blob, "Priority")).toBe("Urgent");
    expect(readNote(blob, "Delivery Schedule")).toBe("2026-09-05");
    expect(readNote(blob, "Nothing")).toBe("");
  });

  it("replaces a line and leaves every other section alone", () => {
    const moved = setNote(blob, "Delivery Schedule", "2026-09-11");

    expect(readNote(moved, "Delivery Schedule")).toBe("2026-09-11");
    expect(readNote(moved, "Priority")).toBe("Urgent");
    expect(readNote(moved, "Request Date")).toBe("2026-09-01");
    expect(moved).toContain("Pickup: Pacific Harvest Main Office @ 08:00");
    expect(moved).toContain("Partner: Batangas Haulers");
    expect(readNotesBody(moved)).toBe("Handle with care");
  });

  it("adds a label that was never written, under the delivery details", () => {
    const without = "[DELIVERY DETAILS]\nRequest Date: 2026-09-01\n\n[NOTES]\nCall ahead";
    const added = setNote(without, "Priority", "High Priority");

    expect(readNote(added, "Priority")).toBe("High Priority");
    expect(readNote(added, "Request Date")).toBe("2026-09-01");
    expect(readNotesBody(added)).toBe("Call ahead");
  });

  it("starts a delivery details section when the blob has none", () => {
    expect(readNote(setNote("", "Priority", "Standard"), "Priority")).toBe("Standard");
  });

  it("replaces the free text without disturbing the sections above it", () => {
    const edited = setNotesBody(blob, "Ring the bell at the gate");

    expect(readNotesBody(edited)).toBe("Ring the bell at the gate");
    expect(readNote(edited, "Priority")).toBe("Urgent");
    expect(edited).toContain("Partner: Batangas Haulers");
  });

  it("drops the notes section when the text is cleared", () => {
    const cleared = setNotesBody(blob, "   ");

    expect(readNotesBody(cleared)).toBe("");
    expect(cleared).not.toContain("[NOTES]");
    expect(readNote(cleared, "Priority")).toBe("Urgent");
  });

  it("adds free text to a booking that had none", () => {
    const bare = "[DELIVERY DETAILS]\nPriority: Standard";
    expect(readNotesBody(setNotesBody(bare, "Fragile"))).toBe("Fragile");
  });
});
