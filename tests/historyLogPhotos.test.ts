import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Editing a maintenance log must not throw its photos away.
//
// The list a log is edited from carries no image data - only whether a phase
// has a photo - so an edit could be saved with every photo empty. The update
// replaced a log's photo rows wholesale, and that deleted them. Photos are now
// added and removed one by one: the edit's new photos are inserted, and only
// the ones the mechanic took off (checked by checkLogPhotos) are deleted.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const { updateHistoryLog } = await import("@/services/history-logs/historyLogsService");

const LOG = "55555555-5555-5555-5555-555555555555";

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
});

/** The answers an update reads, in order: the parent, then the text tables' current rows. */
function existingLog() {
  db.queue(
    { data: { id: LOG } }, // HistoryLogsM update ... select
    { data: [{ id: "mech-1" }] }, // LogMechanics
    { data: [{ id: "note-1" }] }, // LogNotes
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
    existingLog();

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

  it("adds the new photos and removes only the ones taken off", async () => {
    existingLog();

    await updateHistoryLog(LOG, {
      date: "2026-10-03",
      primaryMechanicID: "m1",
      issue: "Replaced the fan belt",
      // What checkLogPhotos leaves on the body.
      checkedPhotos: [{ phase: "Final", photoUrl: "data:image/jpeg;base64,new", position: 2 }],
      removedPhotoIDs: ["photo-final"],
    });

    const photoInsert = db.writes.find((write) => write.table === "LogPhotos" && write.chain.includes("insert"));
    expect(photoInsert?.payload).toEqual([
      { logID: LOG, phase: "Final", photoUrl: "data:image/jpeg;base64,new", position: 2 },
    ]);

    const photoDeletes = db.calls.filter((call) => call.table === "LogPhotos" && call.chain.includes("delete"));
    expect(photoDeletes).toHaveLength(1);
    // By id, and only within this log.
    expect(photoDeletes[0].chain).toEqual(expect.arrayContaining(["in", "eq"]));
  });

  it("is taken back when it fails part-way, rather than leaving two of everything", async () => {
    existingLog();
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
