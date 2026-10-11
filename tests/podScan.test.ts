import { describe, expect, it } from "vitest";
import {
  differenceHash,
  distanceMeters,
  evaluateScan,
  findSignatureLabels,
  hammingDistance,
  nameAppearsIn,
  NAME_NOT_FOUND,
  signatureInk,
  type GrayImage,
  type OcrLine,
  type Rect,
} from "@/app/lib/podScan";
import { checkPodScan, ENFORCE_LOCATION, parseScanReport, type StopPlace } from "@/services/storage/podScanCheck";

// Checking a scanned proof of delivery, without sending it anywhere.
//
// Every client prints their own POD, so the checks cannot know a form's layout.
// They find the place a form asks for a signature by its label, look for pen
// strokes there, and look for the name the crew typed. Whether the photograph
// is real - here, now, not used before - is the server's half.

const WIDTH = 400;
const HEIGHT = 300;

function blankPage(): GrayImage {
  return { width: WIDTH, height: HEIGHT, data: new Uint8Array(WIDTH * HEIGHT).fill(235) };
}

function draw(image: GrayImage, rect: Rect, value = 30) {
  for (let y = rect.top; y < rect.bottom; y++) {
    for (let x = rect.left; x < rect.right; x++) image.data[y * image.width + x] = value;
  }
}

/** A scribble: short diagonal strokes, the way a signature is ink and paper mixed. */
function scribble(image: GrayImage, left: number, top: number) {
  for (let i = 0; i < 80; i++) {
    const x = left + i;
    const y = top + Math.round(10 * Math.sin(i / 6));
    draw(image, { left: x, top: y, right: x + 2, bottom: y + 3 });
  }
}

const LABEL: OcrLine = {
  text: "Received by:",
  box: { left: 20, top: 200, right: 110, bottom: 215 },
  words: [
    { text: "Received", box: { left: 20, top: 200, right: 80, bottom: 215 } },
    { text: "by:", box: { left: 84, top: 200, right: 110, bottom: 215 } },
  ],
};

const BODY = "DELIVERY RECEIPT Acme Trading DR No 10293 Item Qty Cement 40 bags Rebar 12 pcs Date 10/10/2026 Received by Juan Dela Cruz";

describe("the receiver's name on the paper", () => {
  it("is found when it is there", () => {
    expect(nameAppearsIn("Juan Dela Cruz", BODY)).toBe(true);
  });

  it("forgives case, accents and one misread letter in a longer part", () => {
    expect(nameAppearsIn("josé santos", "Received by JOSE SANTCS")).toBe(true);
  });

  it("needs most of the name, not one common word", () => {
    expect(nameAppearsIn("Juan Dela Cruz", "Received by Juan Reyes")).toBe(false);
  });

  it("is not found in an empty name", () => {
    expect(nameAppearsIn("  ", BODY)).toBe(false);
  });
});

describe("where a form asks for a signature", () => {
  it("is found by its label, whatever the layout", () => {
    expect(findSignatureLabels([LABEL, { text: "Item Qty", box: null }])).toHaveLength(1);
    expect(findSignatureLabels([{ text: "Signature over printed name", box: { left: 0, top: 0, right: 10, bottom: 10 } }])).toHaveLength(1);
  });

  it("measures only the label's own words, not the handwriting on its line", () => {
    const line: OcrLine = { ...LABEL, text: "Received by: Juan", box: { left: 20, top: 200, right: 300, bottom: 215 } };
    const [box] = findSignatureLabels([line]);
    expect(box.right).toBe(110);
  });
});

describe("whether it was signed", () => {
  it("sees pen strokes beside the label", () => {
    const page = blankPage();
    scribble(page, 130, 205);
    expect(signatureInk(page, [LABEL], [LABEL.box as Rect])).toBe(true);
  });

  it("calls a blank signature space blank", () => {
    expect(signatureInk(blankPage(), [LABEL], [LABEL.box as Rect])).toBe(false);
  });

  it("does not mistake the printed line a form signs on for a signature", () => {
    const page = blankPage();
    draw(page, { left: 115, top: 213, right: 395, bottom: 215 });
    expect(signatureInk(page, [LABEL], [LABEL.box as Rect])).toBe(false);
  });

  it("says it does not know when the form has no signature label", () => {
    expect(signatureInk(blankPage(), [{ text: "Item Qty", box: null }], [])).toBeNull();
  });
});

describe("what the crew are told", () => {
  it("refuses a page with almost no text: not a readable receipt", () => {
    const verdict = evaluateScan({ text: "Acme", lines: [], image: blankPage(), receiverName: "Juan" });
    expect(verdict.blocking[0]).toMatch(/No receipt text/);
  });

  it("refuses an unsigned receipt", () => {
    const verdict = evaluateScan({ text: BODY, lines: [LABEL], image: blankPage(), receiverName: "Juan Dela Cruz" });
    expect(verdict.blocking[0]).toMatch(/signature space looks blank/);
  });

  it("passes a signed receipt with the name on it", () => {
    const page = blankPage();
    scribble(page, 130, 205);
    const verdict = evaluateScan({ text: BODY, lines: [LABEL], image: page, receiverName: "Juan Dela Cruz" });
    expect(verdict).toMatchObject({ blocking: [], flags: [], signature: true, nameFound: true });
  });

  it("lets a stop close with a name it could not find, for the office to check", () => {
    const page = blankPage();
    scribble(page, 130, 205);
    const verdict = evaluateScan({ text: BODY, lines: [LABEL], image: page, receiverName: "Maria Santos" });
    expect(verdict.blocking).toEqual([]);
    expect(verdict.flags).toEqual([NAME_NOT_FOUND]);
  });
});

describe("the picture's fingerprint", () => {
  it("is the same for the same page and different for another", () => {
    const a = blankPage();
    scribble(a, 130, 205);
    draw(a, { left: 20, top: 20, right: 300, bottom: 60 }, 60);
    const b = blankPage();
    draw(b, { left: 200, top: 100, right: 390, bottom: 290 }, 40);

    const hashA = differenceHash(a);
    expect(hashA).toMatch(/^[0-9a-f]{16}$/);
    expect(hammingDistance(hashA, differenceHash(a))).toBe(0);
    expect(hammingDistance(hashA, differenceHash(b))).toBeGreaterThan(6);
  });
});

describe("distance", () => {
  it("is about 111 m per thousandth of a degree of latitude", () => {
    const d = distanceMeters({ latitude: 14.5995, longitude: 120.9842 }, { latitude: 14.6005, longitude: 120.9842 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(117);
  });
});

// ---- The server's half -----------------------------------------------------

const NOW = Date.parse("2026-10-11T03:00:00.000Z");
const STOP: StopPlace = { latitude: 14.5995, longitude: 120.9842, arrivedAt: "2026-10-11T02:50:00.000Z" };

function report(overrides: Record<string, unknown> = {}) {
  return parseScanReport(
    JSON.stringify({
      method: "scanner",
      capturedAt: "2026-10-11T02:58:00.000Z",
      latitude: 14.5996,
      longitude: 120.9843,
      accuracy: 15,
      textWords: 30,
      signature: true,
      nameFound: true,
      dHash: "0123456789abcdef",
      flags: [],
      ...overrides,
    }),
  );
}

const check = (r: ReturnType<typeof report>, extra: Partial<Parameters<typeof checkPodScan>[0]> = {}) =>
  checkPodScan({ report: r, place: STOP, now: NOW, earlierHashes: [], sameFileUsed: false, ...extra });

describe("a real scan, taken here and now", () => {
  it("passes with nothing to flag", () => {
    expect(check(report())).toEqual({ refusal: null, flags: [] });
  });

  it("carries the phone's own flags to the office", () => {
    expect(check(report({ flags: [NAME_NOT_FOUND] })).flags).toEqual([NAME_NOT_FOUND]);
  });
});

describe("a scan that is not real", () => {
  it("is refused when it is old", () => {
    expect(check(report({ capturedAt: "2026-10-11T02:00:00.000Z" })).refusal).toMatch(/too old/);
  });

  it("is refused when taken before the crew arrived", () => {
    const place = { ...STOP, arrivedAt: "2026-10-11T02:59:30.000Z" };
    expect(check(report({ capturedAt: "2026-10-11T02:40:00.000Z" }), { place }).refusal).toMatch(/before you arrived/);
  });

  it("is refused when the same file was used before", () => {
    expect(check(report(), { sameFileUsed: true }).refusal).toMatch(/already used/);
  });

  it("is refused when the same page was scanned for another stop", () => {
    expect(check(report(), { earlierHashes: ["0123456789abcdee"] }).refusal).toMatch(/already scanned/);
  });

  it("is refused when the phone's own checks were skipped", () => {
    expect(check(report({ signature: false })).refusal).toMatch(/blank/);
    expect(check(report({ textWords: 2 })).refusal).toMatch(/No receipt text/);
  });
});

describe("what cannot be checked", () => {
  it("lets an app without the scanner through, for review", () => {
    const result = check(report({ method: "camera" }));
    expect(result.refusal).toBeNull();
    expect(result.flags[0]).toMatch(/needs updating/);
  });

  it("treats a missing or garbled report as an app without the scanner", () => {
    expect(parseScanReport("not json")).toBeNull();
    expect(check(null).flags[0]).toMatch(/needs updating/);
  });
});

// Switched off for now (ENFORCE_LOCATION), while the scanner is tried on test
// bookings far from whoever is testing. These run again when it is back on.
describe.runIf(ENFORCE_LOCATION)("where the scan was taken", () => {
  it("is refused when taken away from the stop", () => {
    const result = check(report({ latitude: 14.61, longitude: 120.9842 }));
    expect(result.refusal).toMatch(/m from the stop/);
  });

  it("is forgiven a vague GPS fix near the edge, but flagged", () => {
    // About 300 m off, with the phone unsure by 150 m.
    const result = check(report({ latitude: 14.6022, accuracy: 400 }));
    expect(result.refusal).toBeNull();
    expect(result.flags.join(" ")).toMatch(/imprecise/);
  });

  it("flags a stop that has no map location", () => {
    const result = check(report(), { place: { latitude: null, longitude: null, arrivedAt: null } });
    expect(result.flags[0]).toMatch(/no map location/);
  });

  it("flags a phone that gave no location", () => {
    expect(check(report({ latitude: null, longitude: null })).flags[0]).toMatch(/no location/);
  });
});

describe.runIf(!ENFORCE_LOCATION)("while the location check is off", () => {
  it("lets a scan from anywhere through, with nothing flagged", () => {
    expect(check(report({ latitude: 14.7, longitude: 121.1 }))).toEqual({ refusal: null, flags: [] });
  });
});
