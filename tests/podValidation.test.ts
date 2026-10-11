import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The receipt check on a proof-of-delivery photograph.
//
// A stop used to close on any photograph at all. What makes one proof is the
// paper in it - a delivery receipt, signed, with the receiver's name - and the
// check is what says so. Two things matter as much as the check itself: that a
// photograph which falls short tells the crew why, in words they can act on at
// the gate; and that the check being unavailable never holds a truck there.

const parse = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status = 500;
  }
  class Anthropic {
    static APIError = APIError;
    beta = { messages: { parse } };
  }
  return { default: Anthropic };
});

const { validatePodImage, verdictFrom } = await import("@/services/storage/podValidation");

const GOOD = {
  isDeliveryDocument: true,
  hasSignature: true,
  receiverNameVisible: true,
  receiverNameRead: "Juan Dela Cruz",
  problems: [],
};

const BYTES = new Uint8Array([1, 2, 3]).buffer;

describe("what a reading earns", () => {
  it("passes a signed receipt with a readable name, and keeps the name", () => {
    expect(verdictFrom(GOOD)).toEqual({ verdict: "passed", reasons: [], nameOnReceipt: "Juan Dela Cruz" });
  });

  it("refuses an unsigned receipt and says what is missing", () => {
    const result = verdictFrom({ ...GOOD, hasSignature: false });
    expect(result.verdict).toBe("failed");
    expect(result.reasons[0]).toMatch(/signature/i);
  });

  it("refuses a receipt whose name cannot be read", () => {
    const result = verdictFrom({ ...GOOD, receiverNameVisible: false, receiverNameRead: null });
    expect(result.verdict).toBe("failed");
    expect(result.reasons[0]).toMatch(/name/i);
  });

  it("refuses a photograph that is not a receipt, without listing what a receipt would have had", () => {
    const result = verdictFrom({
      ...GOOD,
      isDeliveryDocument: false,
      hasSignature: false,
      receiverNameVisible: false,
      problems: ["Photo shows a gate"],
    });
    expect(result.verdict).toBe("failed");
    expect(result.reasons).toEqual(["The photo does not show a delivery receipt clearly.", "Photo shows a gate"]);
  });

  it("passes the model's own reasons on, since they say how to retake it", () => {
    const result = verdictFrom({ ...GOOD, hasSignature: false, problems: ["Too dark", " "] });
    expect(result.reasons).toContain("Too dark");
    expect(result.reasons).not.toContain(" ");
  });
});

describe("when the check cannot run", () => {
  const key = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    parse.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });
  afterEach(() => {
    if (key === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = key;
  });

  it("asks the API and returns its verdict when it can", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: GOOD });
    const result = await validatePodImage(BYTES, "image/jpeg");
    expect(result.verdict).toBe("passed");

    const request = parse.mock.calls[0][0];
    expect(request.messages[0].content[0].source).toMatchObject({ type: "base64", media_type: "image/jpeg" });
  });

  it("does not hold the truck when no key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await validatePodImage(BYTES, "image/jpeg");
    expect(result.verdict).toBe("unverified");
    expect(parse).not.toHaveBeenCalled();
  });

  it("does not hold the truck when the API fails", async () => {
    parse.mockRejectedValue(new Error("network down"));
    expect((await validatePodImage(BYTES, "image/jpeg")).verdict).toBe("unverified");
  });

  it("does not hold the truck on a refusal or an unreadable answer", async () => {
    parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    expect((await validatePodImage(BYTES, "image/jpeg")).verdict).toBe("unverified");
  });

  it("does not send a file type the API cannot read", async () => {
    const result = await validatePodImage(BYTES, "image/heic");
    expect(result.verdict).toBe("unverified");
    expect(parse).not.toHaveBeenCalled();
  });
});
