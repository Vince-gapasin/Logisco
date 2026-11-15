import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// The maintenance photo check.
//
// A maintenance log took any picture at all - every photo on file was a
// screenshot or a test picture. A mechanic's log now needs a photo for each
// phase it fills; the device refuses one that is not a truck or the work on
// one, and the server refuses one already used, a stale camera photo, and a
// report the device marked refused.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

// The office's mechanic-photo switch, as each test sets it.
let repairMode: "strict" | "relaxed" = "strict";
vi.mock("@/services/settings/photoCheckSettings", () => ({
  getPhotoChecks: async () => ({ podReceiptCheck: "strict", repairPhotoCheck: repairMode }),
}));

const { evaluateRepairPhoto, MIN_MECHANIC_SCORE, shortLabel } = await import("@/app/lib/repairPhoto");
const { checkRepairPhoto, parseRepairPhotoReport, photoHash, MAX_PHOTO_AGE_MS, RELAXED_PREFIX } = await import(
  "@/services/history-logs/repairPhotoCheck"
);
const { checkLogPhotos } = await import("@/services/history-logs/historyLogsService");

const NOW = Date.parse("2026-10-13T08:00:00Z");
const photo = (content: string) => `data:image/jpeg;base64,${Buffer.from(content).toString("base64")}`;
const report = (over: Record<string, unknown> = {}) => ({
  method: "camera",
  capturedAt: new Date(NOW - 60_000).toISOString(),
  model: "mobilenet_v2_100_224",
  checked: true,
  verdict: "passed",
  score: 0.8,
  topLabels: ["pickup", "car wheel"],
  dHash: "0f0f0f0f0f0f0f0f",
  ...over,
});

beforeEach(() => {
  repairMode = "strict";
  db.calls.length = 0;
  db.writes.length = 0;
});

describe("what the device decides", () => {
  it("passes a truck, a part of one, or the tools", () => {
    expect(evaluateRepairPhoto([{ className: "pickup, pickup truck", probability: 0.7 }]).verdict).toBe("passed");
    expect(
      evaluateRepairPhoto([
        { className: "trailer truck, tractor trailer, trucking rig, rig, articulated lorry, semi", probability: 0.4 },
      ]).verdict,
    ).toBe("passed");
    // A close-up the model is unsure of, spread over several neighbours.
    expect(
      evaluateRepairPhoto([
        { className: "grille, radiator grille", probability: 0.12 },
        { className: "car wheel", probability: 0.1 },
        { className: "web site", probability: 0.05 },
      ]).verdict,
    ).toBe("passed");
  });

  it("refuses a screenshot, a document or a person, and says what it saw", () => {
    const screenshot = evaluateRepairPhoto([
      { className: "web site, website, internet site, site", probability: 0.83 },
      { className: "menu", probability: 0.02 },
    ]);
    expect(screenshot.verdict).toBe("refused");
    expect(screenshot.reason).toContain("web site");
    expect(evaluateRepairPhoto([{ className: "lab coat, laboratory coat", probability: 0.8 }]).verdict).toBe("refused");
    // A trace of a mechanic class is not enough.
    expect(
      evaluateRepairPhoto([
        { className: "wall clock", probability: 0.08 },
        { className: "screw", probability: MIN_MECHANIC_SCORE / 4 },
      ]).verdict,
    ).toBe("refused");
  });

  it("reads a label by its first name", () => {
    expect(shortLabel("disk brake, disc brake")).toBe("disk brake");
  });
});

describe("the report the device sends", () => {
  it("is read from an object or a JSON string, and anything else is nothing", () => {
    expect(parseRepairPhotoReport(report())?.method).toBe("camera");
    expect(parseRepairPhotoReport(JSON.stringify(report()))?.verdict).toBe("passed");
    expect(parseRepairPhotoReport("not json")).toBeNull();
    expect(parseRepairPhotoReport({ method: "upload" })).toBeNull();
    expect(parseRepairPhotoReport(null)).toBeNull();
  });

  it("keeps only what it should", () => {
    const parsed = parseRepairPhotoReport(report({ score: 7, dHash: "nope", topLabels: [1, "pickup", "a".repeat(99)] }));
    expect(parsed?.score).toBe(1);
    expect(parsed?.dHash).toBeNull();
    expect(parsed?.topLabels).toEqual(["pickup", "a".repeat(40)]);
  });
});

describe("what the server checks", () => {
  const check = (over: Partial<Parameters<typeof checkRepairPhoto>[0]> = {}) =>
    checkRepairPhoto({
      dataUrl: photo("a truck"),
      report: parseRepairPhotoReport(report()),
      now: NOW,
      sameFileUsed: false,
      earlierHashes: [],
      ...over,
    });

  it("passes a fresh camera photo the device passed", () => {
    const result = check();
    expect(result.refusal).toBeNull();
    expect(result.meta.checkStatus).toBe("passed");
    expect(result.meta.imageHash).toBe(photoHash(photo("a truck")));
  });

  it("refuses a photo already on another log, exactly or nearly", () => {
    expect(check({ sameFileUsed: true }).refusal).toMatch(/already on another/);
    // Two bits off: the same picture re-saved.
    expect(check({ earlierHashes: ["0f0f0f0f0f0f0f0c"] }).refusal).toMatch(/already used/);
    expect(check({ earlierHashes: ["f0f0f0f0f0f0f0f0"] }).refusal).toBeNull();
  });

  it("refuses a report the device refused - a request that went around the form", () => {
    expect(check({ report: parseRepairPhotoReport(report({ verdict: "refused" })) }).refusal).toMatch(/not accepted/);
  });

  it("refuses a camera photo that is not recent", () => {
    const old = new Date(NOW - MAX_PHOTO_AGE_MS - 60_000).toISOString();
    expect(check({ report: parseRepairPhotoReport(report({ capturedAt: old })) }).refusal).toMatch(/too old/);
  });

  it("keeps for review what it could not check, rather than stranding the mechanic", () => {
    const unchecked = check({ report: parseRepairPhotoReport(report({ checked: false, verdict: null })) });
    expect(unchecked.refusal).toBeNull();
    expect(unchecked.meta.checkStatus).toBe("unverified");

    const fromFile = check({ report: parseRepairPhotoReport(report({ method: "file" })) });
    expect(fromFile.refusal).toBeNull();
    expect(fromFile.meta.checkStatus).toBe("unverified");
    expect(fromFile.meta.checkLabels?.notes[0]).toMatch(/file/);

    // From the phone's gallery: checked, kept, but not taken just now.
    const fromGallery = check({ report: parseRepairPhotoReport(report({ method: "gallery" })) });
    expect(fromGallery.refusal).toBeNull();
    expect(fromGallery.meta.captureMethod).toBe("gallery");
    expect(fromGallery.meta.checkStatus).toBe("unverified");
    expect(fromGallery.meta.checkLabels?.notes[0]).toMatch(/gallery/);

    expect(check({ report: null }).meta.checkStatus).toBe("unverified");
  });
});

describe("saving a log", () => {
  const inspection = (over: Record<string, unknown> = {}) => ({
    truckID: "t1",
    date: "2026-10-13",
    driversReport: "Brakes squeal",
    ...over,
  });

  it("needs a photo from a mechanic, not from the office", async () => {
    expect(await checkLogPhotos(inspection(), { requirePhotos: true })).toEqual({
      status: 400,
      message: "A photo is required for the inspection.",
    });
    expect(await checkLogPhotos(inspection(), { requirePhotos: false })).toBeNull();
    expect(db.calls).toHaveLength(0);
  });

  it("refuses a photo the device refused, before anything is written", async () => {
    db.queue({ data: [] }, { data: [] });
    const answer = await checkLogPhotos(
      inspection({ preliminaryPhotoUrl: photo("a selfie"), preliminaryPhotoReport: JSON.stringify(report({ verdict: "refused" })) }),
      { requirePhotos: true },
    );
    expect(answer?.status).toBe(422);
    expect(db.writes).toHaveLength(0);
  });

  it("leaves what the check found for the save, and never what the caller claimed", async () => {
    db.queue({ data: [] }, { data: [] });
    const body: Record<string, unknown> = inspection({
      preliminaryPhotoUrl: photo("a truck"),
      // checkLogPhotos reads the real clock.
      preliminaryPhotoReport: report({ capturedAt: new Date().toISOString() }),
      preliminaryPhotoUrlMeta: { checkStatus: "passed", imageHash: "forged" },
    });
    expect(await checkLogPhotos(body, { requirePhotos: true })).toBeNull();
    expect(body.preliminaryPhotoUrlMeta).toBeUndefined();
    expect(body.checkedPhotos).toEqual([
      expect.objectContaining({
        phase: "Preliminary",
        position: 1,
        checkStatus: "passed",
        imageHash: photoHash(photo("a truck")),
      }),
    ]);
  });

  it("does not check again a photo an older screen sends back unchanged", async () => {
    const onFile = photo("the photo already on the log");
    db.queue(
      { data: [{ id: "p1", phase: "Preliminary", position: 1 }] },
      { data: [{ phase: "Preliminary", photoUrl: onFile }] },
    );
    const body: Record<string, unknown> = inspection({ preliminaryPhotoUrl: onFile });
    expect(await checkLogPhotos(body, { requirePhotos: true, logID: "log-1" })).toBeNull();
    // Taken out, so the photo on file stays with what its check found.
    expect(body.preliminaryPhotoUrl).toBeUndefined();
    expect(body.checkedPhotos).toEqual([]);
    expect(db.calls).toHaveLength(2);
  });
});

describe("several photos in a phase", () => {
  const inspection = (over: Record<string, unknown> = {}) => ({
    truckID: "t1",
    date: "2026-10-13",
    driversReport: "Brakes squeal",
    ...over,
  });
  const fresh = (content: string) => ({
    dataUrl: photo(content),
    report: report({ capturedAt: new Date().toISOString() }),
  });

  it("checks each new photo and places it after the ones on file", async () => {
    db.queue(
      { data: [{ id: "p1", phase: "Preliminary", position: 1 }] }, // the log's photos
      { data: [] }, // same file elsewhere
      { data: [] }, // earlier fingerprints
    );
    const body: Record<string, unknown> = inspection({
      newPhotos: { Preliminary: [fresh("the brake pads"), fresh("the rotor")] },
    });
    expect(await checkLogPhotos(body, { requirePhotos: true, logID: "log-1" })).toBeNull();
    expect(body.newPhotos).toBeUndefined();
    expect(body.checkedPhotos).toEqual([
      expect.objectContaining({ phase: "Preliminary", position: 2, photoUrl: photo("the brake pads") }),
      expect.objectContaining({ phase: "Preliminary", position: 3, photoUrl: photo("the rotor") }),
    ]);
  });

  it("refuses more than ten in a phase", async () => {
    db.queue({
      data: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ id: `p${n}`, phase: "Preliminary", position: n })),
    });
    const body: Record<string, unknown> = inspection({
      newPhotos: { Preliminary: [fresh("ten"), fresh("eleven")] },
    });
    expect(await checkLogPhotos(body, { requirePhotos: true, logID: "log-1" })).toEqual({
      status: 400,
      message: "The inspection can have at most 10 photos.",
    });
  });

  it("lets a photo be swapped, but not the last one taken away", async () => {
    db.queue({ data: [{ id: "p1", phase: "Preliminary", position: 1 }] });
    const emptied: Record<string, unknown> = inspection({ removedPhotoIDs: ["p1"] });
    expect(await checkLogPhotos(emptied, { requirePhotos: true, logID: "log-1" })).toEqual({
      status: 400,
      message: "Keep at least one photo on the inspection.",
    });

    db.queue({ data: [{ id: "p1", phase: "Preliminary", position: 1 }] }, { data: [] }, { data: [] });
    const swapped: Record<string, unknown> = inspection({
      removedPhotoIDs: ["p1"],
      newPhotos: { Preliminary: [fresh("a better one")] },
    });
    expect(await checkLogPhotos(swapped, { requirePhotos: true, logID: "log-1" })).toBeNull();
    expect(swapped.removedPhotoIDs).toEqual(["p1"]);
  });

  it("only removes the log's own photos", async () => {
    db.queue({
      data: [
        { id: "p1", phase: "Preliminary", position: 1 },
        { id: "p2", phase: "Preliminary", position: 2 },
      ],
    });
    const body: Record<string, unknown> = inspection({ removedPhotoIDs: ["p2", "someone-elses"] });
    expect(await checkLogPhotos(body, { requirePhotos: true, logID: "log-1" })).toBeNull();
    expect(body.removedPhotoIDs).toEqual(["p2"]);
  });

  it("refuses the same photo added twice", async () => {
    const body: Record<string, unknown> = inspection({
      newPhotos: { Preliminary: [fresh("the same"), fresh("the same")] },
    });
    expect(await checkLogPhotos(body, { requirePhotos: true })).toEqual({
      status: 422,
      message: "The same photo was added twice. Remove one of them.",
    });
  });

  it("does not make an old log get a photo when it is edited", async () => {
    db.queue({ data: [] });
    expect(await checkLogPhotos(inspection(), { requirePhotos: true, logID: "old-log" })).toBeNull();
  });
});

describe("with the mechanic photo check relaxed", () => {
  const relaxedCheck = (over: Partial<Parameters<typeof checkRepairPhoto>[0]> = {}) =>
    checkRepairPhoto({
      dataUrl: photo("a truck"),
      report: parseRepairPhotoReport(report()),
      now: NOW,
      sameFileUsed: false,
      earlierHashes: [],
      mode: "relaxed",
      ...over,
    });

  it("keeps what strict refuses, as unverified with the reason", () => {
    const old = new Date(NOW - MAX_PHOTO_AGE_MS - 60_000).toISOString();
    for (const over of [
      { sameFileUsed: true },
      { earlierHashes: ["0f0f0f0f0f0f0f0c"] },
      { report: parseRepairPhotoReport(report({ verdict: "refused" })) },
      { report: parseRepairPhotoReport(report({ capturedAt: old })) },
    ]) {
      const result = relaxedCheck(over);
      expect(result.refusal).toBeNull();
      expect(result.meta.checkStatus).toBe("unverified");
      expect(result.meta.checkLabels?.notes.some((note) => note.startsWith(RELAXED_PREFIX))).toBe(true);
    }
  });

  it("passes a good photo as strict does", () => {
    expect(relaxedCheck().meta.checkStatus).toBe("passed");
  });

  it("saves a log with a refused photo and the same photo twice", async () => {
    repairMode = "relaxed";
    db.queue({ data: [] }, { data: [] });
    const fresh = { dataUrl: photo("not a truck"), report: report({ verdict: "refused", capturedAt: new Date().toISOString() }) };
    const body: Record<string, unknown> = {
      truckID: "t1",
      date: "2026-10-13",
      driversReport: "Brakes squeal",
      newPhotos: { Preliminary: [fresh, fresh] },
    };
    expect(await checkLogPhotos(body, { requirePhotos: true })).toBeNull();
    const saved = body.checkedPhotos as { checkStatus: string; checkLabels: { notes: string[] } }[];
    expect(saved).toHaveLength(2);
    expect(saved.every((photo) => photo.checkStatus === "unverified")).toBe(true);
    expect(saved[1].checkLabels.notes[0]).toMatch(/added twice/);
  });

  it("still needs a photo, and still stops at ten", async () => {
    repairMode = "relaxed";
    expect(
      await checkLogPhotos({ truckID: "t1", date: "2026-10-13", driversReport: "Brakes squeal" }, { requirePhotos: true }),
    ).toEqual({ status: 400, message: "A photo is required for the inspection." });
  });
});
