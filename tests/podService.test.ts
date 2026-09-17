import { describe, expect, it, vi } from "vitest";

// The module reaches for Supabase at import time; the path helper under test
// does not use it.
vi.mock("@/app/lib/supabase", () => ({ supabase: { storage: { from: () => ({}) } } }));

const { toPodObjectPath } = await import("@/services/storage/podService");

describe("recovering the storage path of a proof of delivery", () => {
  it("passes a stored path through", () => {
    expect(toPodObjectPath("pod-abc-1700000000-photo.jpg")).toBe("pod-abc-1700000000-photo.jpg");
  });

  it("recovers the path from a public URL written by the old code", () => {
    expect(
      toPodObjectPath(
        "https://xyz.supabase.co/storage/v1/object/public/delivery_proofs/pod-abc-1700000000-photo.jpg",
      ),
    ).toBe("pod-abc-1700000000-photo.jpg");
  });

  it("drops the query string a signed URL carries", () => {
    expect(
      toPodObjectPath(
        "https://xyz.supabase.co/storage/v1/object/sign/delivery_proofs/pod-1.jpg?token=eyJhbGci",
      ),
    ).toBe("pod-1.jpg");
  });

  it("decodes an escaped filename", () => {
    expect(
      toPodObjectPath("https://xyz.supabase.co/storage/v1/object/public/delivery_proofs/pod%20one.jpg"),
    ).toBe("pod one.jpg");
  });

  it("returns nothing for a URL that is not in this bucket", () => {
    expect(toPodObjectPath("https://example.com/some/other/photo.jpg")).toBeNull();
  });

  it("returns nothing for an empty value", () => {
    expect(toPodObjectPath("")).toBeNull();
    expect(toPodObjectPath(null)).toBeNull();
    expect(toPodObjectPath(undefined)).toBeNull();
  });
});
