import { describe, expect, it, vi } from "vitest";

// The module creates a Supabase client at import; the helpers under test do
// not touch it.
vi.mock("@/app/lib/supabase", () => ({ supabase: {} }));

const { bookingDestination, looselyContains, normalizeQuery, withQuery } = await import(
  "@/services/search/searchService"
);

describe("cleaning what was typed into the search box", () => {
  it("keeps order codes, plates and names intact", () => {
    expect(normalizeQuery("ORD-891450-C35Z")).toBe("ORD-891450-C35Z");
    expect(normalizeQuery("NBC-8241")).toBe("NBC-8241");
    expect(normalizeQuery("Parañaque")).toBe("Parañaque");
    expect(normalizeQuery("Max's & Co.")).toBe("Max's & Co.");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeQuery("   army    navy  ")).toBe("army navy");
  });

  it("strips the characters PostgREST reads as filter syntax", () => {
    // An attempt to close the quoted value and append a filter of its own.
    const cleaned = normalizeQuery('x"),or(isActive.eq.false');
    expect(cleaned).not.toMatch(/[",()]/);
  });

  it("strips LIKE wildcards, so a query cannot match everything", () => {
    expect(normalizeQuery("%_%")).toBeNull();
    expect(normalizeQuery("a%b")).toBe("a b");
  });

  it("refuses anything shorter than two characters once cleaned", () => {
    expect(normalizeQuery("a")).toBeNull();
    expect(normalizeQuery("  ")).toBeNull();
    expect(normalizeQuery(null)).toBeNull();
    expect(normalizeQuery(42)).toBeNull();
  });

  it("caps the length", () => {
    expect(normalizeQuery("x".repeat(200))?.length).toBe(60);
  });
});

describe("which booking screen a result opens", () => {
  it("sends a booking with no dispatch to be assigned", () => {
    expect(bookingDestination([])?.path).toBe("/admindashboard/calendar/unassigned-bookings");
  });

  it("sends a booking whose only dispatch was rejected back to be assigned", () => {
    expect(bookingDestination(["Rejected"])?.path).toBe("/admindashboard/calendar/unassigned-bookings");
  });

  it("follows the live dispatch, not a rejected one before it", () => {
    expect(bookingDestination(["Rejected", "In Transit"])?.path).toBe("/admindashboard/feeds/in-transit");
  });

  it("maps each stage to the screen that lists it", () => {
    expect(bookingDestination(["Assigned"])?.path).toBe("/admindashboard/calendar/awaiting-confirmation");
    expect(bookingDestination(["Accepted"])?.path).toBe("/admindashboard/feeds/pending");
    expect(bookingDestination(["Arrived"])?.path).toBe("/admindashboard/feeds/in-transit");
    expect(bookingDestination(["Returned"])?.path).toBe("/admindashboard/feeds/completed");
    expect(bookingDestination(["Foul Trip"])?.path).toBe("/admindashboard/feeds/foul-trip");
  });

  it("offers no link for a cancelled dispatch, since no screen lists one", () => {
    expect(bookingDestination(["Cancelled"])).toBeNull();
  });
});

describe("building the link", () => {
  it("encodes the value so spaces and ampersands survive", () => {
    expect(withQuery("/admindashboard/clients", "Max's & Co")).toBe(
      "/admindashboard/clients?q=Max's%20%26%20Co",
    );
  });
});

describe("matching a driver's own trips", () => {
  it("ignores case and accents", () => {
    expect(looselyContains("Parañaque Hub", "paranaque")).toBe(true);
    expect(looselyContains("ORD-626745-SM7C", "sm7c")).toBe(true);
    expect(looselyContains("Burger King", "bonchon")).toBe(false);
    expect(looselyContains(null, "x")).toBe(false);
  });
});
