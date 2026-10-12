import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Editing a maintenance log must not throw its photos away.
//
// The list a log is edited from carries no image data - only whether a phase
// has a photo - so an edit could be saved with every photo empty. The update
// replaced a log's photo rows wholesale, and that deleted them. A phase's photo
// is now replaced only when the edit brings a new one.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const { updateHistoryLog } = await import("@/services/history-logs/historyLogsService");

const LOG = "55555555-5555-5555-5555-555555555555";

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
});

/** The answers an update reads, in order: the parent, then each child table's current rows. */
function existingLog(photos: { id: string; phase: string }[]) {
  db.queue(
    { data: { id: LOG } }, // HistoryLogsM update ... select
    { data: [{ id: "mech-1" }] }, // LogMechanics
    { data: [{ id: "note-1" }] }, // LogNotes
    { data: photos }, // LogPhotos
  );
}

/** The ids each delete removed, by table. */
function deletedRows() {
  return db.calls
    .filter((call) => call.chain.includes("delete"))
    .map((call) => call.table);
}

describe("editing a log", () => {
  it("keeps the photos when the edit sends none", async () => {
    existingLog([
      { id: "photo-pre", phase: "Preliminary" },
      { id: "photo-final", phase: "Final" },
    ]);

    await updateHistoryLog(LOG, {
      date: "2026-10-03",
      primaryMechanicID: "m1",
      issue: "Replaced the fan belt",
      // What an edit opened before the images loaded sends.
      preliminaryPhotoUrl: "",
      photoUrl: "",
    });

    expect(deletedRows()).not.toContain("LogPhotos");
    // The text is still replaced as before.
    expect(deletedRows()).toEqual(expect.arrayContaining(["LogMechanics", "LogNotes"]));
  });

  it("replaces only the phase that got a new photo", async () => {
    existingLog([
      { id: "photo-pre", phase: "Preliminary" },
      { id: "photo-final", phase: "Final" },
    ]);

    await updateHistoryLog(LOG, {
      date: "2026-10-03",
      primaryMechanicID: "m1",
      issue: "Replaced the fan belt",
      photoUrl: "data:image/jpeg;base64,new",
    });

    const photoInsert = db.writes.find((write) => write.table === "LogPhotos" && write.chain.includes("insert"));
    expect(photoInsert?.payload).toEqual([
      { logID: LOG, phase: "Final", photoUrl: "data:image/jpeg;base64,new" },
    ]);

    const photoDelete = db.calls.find((call) => call.table === "LogPhotos" && call.chain.includes("delete"));
    expect(photoDelete).toBeDefined();
    // Only the old Final photo goes; the Preliminary one stays.
    expect(photoDelete?.chain).toContain("in");
  });

  it("is taken back when it fails part-way, rather than leaving two of everything", async () => {
    existingLog([]);
    db.queue(
      { data: [{ id: "mech-new" }] }, // LogMechanics insert
      { data: null, error: { message: "down" } }, // LogNotes insert fails
    );

    await expect(
      updateHistoryLog(LOG, { date: "2026-10-03", primaryMechanicID: "m1", issue: "Replaced the fan belt" }),
    ).rejects.toThrow("Failed to save LogNotes");

    // The new mechanic row goes; the old rows are left as they were.
    const deletes = db.writes.filter((write) => write.chain.includes("delete")).map((write) => write.table);
    expect(deletes).toEqual(["LogMechanics"]);
    const undo = db.calls.find((call) => call.table === "LogMechanics" && call.chain.includes("delete"));
    expect(undo?.chain).toContain("in");
  });
});
