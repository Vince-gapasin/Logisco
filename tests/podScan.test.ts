import { describe, expect, it } from "vitest";
import {
  BLANK_SIGNATURE,
  differenceHash,
  distanceMeters,
  evaluateScan,
  findSignatureLabels,
  hammingDistance,
  nameAppearsIn,
  nameOnReceipt,
  NAME_NOT_FOUND,
  NO_SIGNATURE_SPACE,
  NO_TEXT,
  printedBoxes,
  signatureInk,
  type GrayImage,
  type OcrLine,
  type OcrWord,
  type Rect,
} from "@/app/lib/podScan";
import { checkPodScan, ENFORCE_LOCATION, parseScanReport, type StopPlace } from "@/services/storage/podScanCheck";
import { documentNumbers } from "@/app/lib/podScan";

// Checking a scanned proof of delivery, without sending it anywhere.
//
// Every client prints their own POD, so the checks cannot know a form's layout.
// They find the place a form asks for a signature by its label, look for pen
// strokes there that are not print, and look for the receiver's name written
// by it. Whether the photograph is real - here, now, not used before - is the
// server's half.
//
// The pages below are drawn the way the sample receipt is laid out:
//
//   Received by:   Juan Dela Cruz  <signature>
//                  ________________________________
//                     Signature over Printed Name

const WIDTH = 600;
const HEIGHT = 400;

function blankPage(): GrayImage {
  return { width: WIDTH, height: HEIGHT, data: new Uint8Array(WIDTH * HEIGHT).fill(235) };
}

function draw(image: GrayImage, rect: Rect, value = 30) {
  for (let y = Math.max(0, rect.top); y < Math.min(image.height, rect.bottom); y++) {
    for (let x = Math.max(0, rect.left); x < Math.min(image.width, rect.right); x++) image.data[y * image.width + x] = value;
  }
}

/** Print or handwriting the reader recognised: letter-like strokes in a box. */
function text(image: GrayImage, box: Rect) {
  for (let x = box.left + 1; x < box.right - 1; x += 4) draw(image, { left: x, top: box.top + 2, right: x + 2, bottom: box.bottom - 2 });
}

/** A signature: one looping stroke, rising and falling across a line of text or more. */
function scribble(image: GrayImage, left: number, top: number) {
  for (let i = 0; i < 90; i++) {
    const x = left + i;
    const y = top + 14 + Math.round(14 * Math.sin(i / 7));
    draw(image, { left: x, top: y, right: x + 2, bottom: y + 3 });
  }
}

/** A printed rule, optionally photographed at a slant. */
function rule(image: GrayImage, left: number, right: number, y: number, slant = 0) {
  for (let x = left; x < right; x++) {
    const yy = y + Math.round(((x - left) / (right - left)) * slant);
    draw(image, { left: x, top: yy, right: x + 1, bottom: yy + 2 });
  }
}

function word(t: string, left: number, top: number, right: number, bottom: number): OcrWord {
  return { text: t, box: { left, top, right, bottom } };
}

function line(words: OcrWord[]): OcrLine {
  const boxes = words.map((w) => w.box as Rect);
  return {
    text: words.map((w) => w.text).join(" "),
    box: {
      left: Math.min(...boxes.map((b) => b.left)),
      top: Math.min(...boxes.map((b) => b.top)),
      right: Math.max(...boxes.map((b) => b.right)),
      bottom: Math.max(...boxes.map((b) => b.bottom)),
    },
    words,
  };
}

const HEADER = line([word("MAIN", 20, 20, 80, 40), word("BRANCH", 85, 20, 170, 40), word("DELIVERY", 180, 20, 290, 40), word("RECEIPT", 295, 20, 390, 40)]);
const LABEL = line([word("Received", 20, 200, 90, 216), word("by:", 94, 200, 115, 216)]);
const CAPTION = line([word("Signature", 170, 250, 240, 264), word("over", 245, 250, 275, 264), word("Printed", 280, 250, 330, 264), word("Name", 335, 250, 370, 264)]);
const NAME = line([word("Juan", 150, 202, 190, 222), word("Dela", 196, 202, 236, 222), word("Cruz", 242, 202, 282, 222)]);

/** The form as printed: header, label, the line to sign on, its caption. */
function form(slant = 0): GrayImage {
  const page = blankPage();
  for (const l of [HEADER, LABEL, CAPTION]) for (const w of l.words ?? []) text(page, w.box as Rect);
  rule(page, 130, 520, 238, slant);
  return page;
}

function signedForm(): GrayImage {
  const page = form();
  for (const w of NAME.words ?? []) text(page, w.box as Rect);
  scribble(page, 300, 200);
  return page;
}

const BODY = "DELIVERY RECEIPT Acme Trading DR No 10293 Item Qty Cement 40 bags Rebar 12 pcs Date 10/10/2026";

const ink = (page: GrayImage, lines: OcrLine[]) => signatureInk(page, lines, printedBoxes(lines));

describe("the receiver's name", () => {
  it("is found when it is there", () => {
    expect(nameAppearsIn("Juan Dela Cruz", "Received by Juan Dela Cruz")).toBe(true);
  });

  it("forgives case, accents and one misread letter in a longer part", () => {
    expect(nameAppearsIn("josé santos", "Received by JOSE SANTCS")).toBe(true);
  });

  it("needs most of the name, not one common word", () => {
    expect(nameAppearsIn("Juan Dela Cruz", "Received by Juan Reyes")).toBe(false);
  });

  it("must be written by the signature, not merely somewhere on the page", () => {
    // The branch's own name, printed in the header, does not pass for the receiver's.
    expect(nameOnReceipt("Main Branch", [HEADER, LABEL, CAPTION], WIDTH, HEIGHT)).toBe(false);
    expect(nameOnReceipt("Juan Dela Cruz", [HEADER, LABEL, NAME, CAPTION], WIDTH, HEIGHT)).toBe(true);
  });

  it("is not found on a form with nowhere to write it", () => {
    expect(nameOnReceipt("Juan Dela Cruz", [HEADER], WIDTH, HEIGHT)).toBe(false);
  });
});

describe("where a form asks for a signature", () => {
  it("is found by its label, whatever the layout", () => {
    expect(findSignatureLabels([LABEL, HEADER])).toHaveLength(1);
    expect(findSignatureLabels([CAPTION])).toHaveLength(1);
  });

  it("measures only the label's own words, not the handwriting on its line", () => {
    const [box] = findSignatureLabels([line([...(LABEL.words ?? []), word("Juan", 150, 202, 190, 222)])]);
    expect(box.right).toBe(115);
  });
});

describe("whether it was signed", () => {
  it("calls the printed form, with nobody's pen on it, blank", () => {
    // The bug: the caption's printed words beside "Signature" were counted as ink.
    expect(ink(form(), [HEADER, LABEL, CAPTION])).toBe(false);
  });

  it("is not fooled by the line to sign on, even photographed at a slant", () => {
    expect(ink(form(8), [HEADER, LABEL, CAPTION])).toBe(false);
  });

  it("does not take a printed name alone for a signature", () => {
    const page = form();
    for (const w of NAME.words ?? []) text(page, w.box as Rect);
    expect(ink(page, [HEADER, LABEL, NAME, CAPTION])).toBe(false);
  });

  it("sees a signature beside the name", () => {
    expect(ink(signedForm(), [HEADER, LABEL, NAME, CAPTION])).toBe(true);
  });

  it("sees a signature that runs across the line it is signed on", () => {
    const page = form(4);
    for (const w of NAME.words ?? []) text(page, w.box as Rect);
    scribble(page, 300, 222);
    expect(ink(page, [HEADER, LABEL, NAME, CAPTION])).toBe(true);
  });

  it("still sees it when the reader made a word of the scribble", () => {
    const misread = line([word("Jlw", 300, 200, 392, 232)]);
    expect(ink(signedForm(), [HEADER, LABEL, NAME, misread, CAPTION])).toBe(true);
  });

  it("does not know when the form has no signature label", () => {
    expect(ink(blankPage(), [HEADER])).toBeNull();
  });
});

describe("what the crew are told", () => {
  const scan = (page: GrayImage, lines: OcrLine[], receiverName = "Juan Dela Cruz", body = BODY) =>
    evaluateScan({ text: `${body} ${lines.map((l) => l.text).join(" ")}`, lines, image: page, receiverName });

  it("passes a signed receipt with the receiver's name by the signature", () => {
    const verdict = scan(signedForm(), [HEADER, LABEL, NAME, CAPTION]);
    expect(verdict).toMatchObject({ blocking: [], flags: [], signature: true, nameFound: true });
  });

  it("refuses the unsigned form, with no name on it", () => {
    const verdict = scan(form(), [HEADER, LABEL, CAPTION]);
    expect(verdict.blocking).toEqual([BLANK_SIGNATURE, NAME_NOT_FOUND]);
  });

  it("refuses a signed receipt without the receiver's name", () => {
    const verdict = scan(signedForm(), [HEADER, LABEL, NAME, CAPTION], "Maria Santos");
    expect(verdict.blocking).toEqual([NAME_NOT_FOUND]);
  });

  it("refuses a page with no signature space it can find", () => {
    const verdict = scan(blankPage(), [HEADER]);
    expect(verdict.blocking).toContain(NO_SIGNATURE_SPACE);
  });

  it("refuses a page with almost no text: not a readable receipt", () => {
    const verdict = evaluateScan({ text: "Acme", lines: [], image: blankPage(), receiverName: "Juan" });
    expect(verdict.blocking).toEqual([NO_TEXT]);
  });
});

describe("the picture's fingerprint", () => {
  it("is the same for the same page and different for another", () => {
    const a = signedForm();
    const b = blankPage();
    draw(b, { left: 300, top: 150, right: 590, bottom: 390 }, 40);

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

describe("the numbers on a page", () => {
  it("are its document number, dates and quantities, not its words", () => {
    expect(documentNumbers("DR No. 0010293  Date 10/11/2026  40 bags  100 pcs  Rebar 10mm")).toEqual(
      ["0010293", "100", "10mm", "2026"],
    );
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
      docNumbers: ["0010293", "10112026", "100"],
      flags: [],
      ...overrides,
    }),
  );
}

const check = (r: ReturnType<typeof report>, extra: Partial<Parameters<typeof checkPodScan>[0]> = {}) =>
  checkPodScan({ report: r, place: STOP, now: NOW, earlierScans: [], sameFileUsed: false, ...extra });

describe("a real scan, taken here and now", () => {
  it("passes with nothing to flag", () => {
    expect(check(report())).toEqual({ refusal: null, flags: [] });
  });

  it("carries the phone's own flags to the office", () => {
    expect(check(report({ flags: ["Something to look at."] })).flags).toEqual(["Something to look at."]);
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
    // Photographed again: one bit off, and the reader missed a digit of the date.
    const again = { dHash: "0123456789abcdee", docNumbers: ["0010293", "1011026", "100"] };
    const result = check(report({ docNumbers: ["0010293", "1011026", "100", "2026"] }), { earlierScans: [again] });
    expect(result.refusal).toMatch(/already scanned/);
  });

  it("is not mistaken for another receipt on the same client's form", () => {
    // Same layout - the picture's fingerprint barely differs - but its own DR
    // number, date and quantities. A crew member delivering to three branches
    // of one client scans three of these in a day.
    const sameForm = { dHash: "0123456789abcdef", docNumbers: ["0010294", "10122026", "240"] };
    expect(check(report(), { earlierScans: [sameForm] }).refusal).toBeNull();
  });

  it("is refused when the phone's own checks were skipped", () => {
    expect(check(report({ signature: false })).refusal).toBe(BLANK_SIGNATURE);
    expect(check(report({ signature: null })).refusal).toBe(NO_SIGNATURE_SPACE);
    expect(check(report({ nameFound: false })).refusal).toBe(NAME_NOT_FOUND);
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
