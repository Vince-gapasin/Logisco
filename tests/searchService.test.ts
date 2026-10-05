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

const { codeRemainder, likeClauses, orderCodeClauses, queryShape, rankResults, scoreMatch } = await import(
  "@/services/search/searchService"
);

const code = (value: string) => [{ value, prefix: "ORD-" }];

describe("scoring a match", () => {
  it("ranks exact over start over word start over middle", () => {
    const exact = scoreMatch("cruz", [{ value: "Cruz" }])!;
    const start = scoreMatch("cruz", [{ value: "Cruz Logistics" }])!;
    const word = scoreMatch("cruz", [{ value: "Dela Cruz Trading" }])!;
    const middle = scoreMatch("cruz", [{ value: "Veracruz Foods" }])!;
    expect(exact).toBeGreaterThan(start);
    expect(start).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(middle);
  });

  it("only matches two characters at the start of a word", () => {
    expect(scoreMatch("an", [{ value: "Andaya" }])).not.toBeNull();
    expect(scoreMatch("an", [{ value: "Juan Santos" }])).toBeNull();
  });

  it("ignores the ORD- prefix every booking code carries", () => {
    expect(scoreMatch("or", code("ORD-482913-K7AN"))).toBeNull();
    expect(scoreMatch("ord", code("ORD-482913-K7AN"))).toBeNull();
    expect(scoreMatch("48", code("ORD-482913-K7AN"))).not.toBeNull();
    expect(scoreMatch("k7an", code("ORD-482913-K7AN"))).not.toBeNull();
    expect(scoreMatch("ord-4829", code("ORD-482913-K7AN"))).not.toBeNull();
    expect(scoreMatch("ord4829", code("ORD-482913-K7AN"))).not.toBeNull();
    expect(scoreMatch("ORD-482913-K7AN", code("ORD-482913-K7AN"))).toBe(100);
  });

  it("matches a plate however it is spaced", () => {
    expect(scoreMatch("abc1234", [{ value: "ABC 1234" }])).toBeGreaterThanOrEqual(95);
    expect(scoreMatch("abc-1234", [{ value: "ABC 1234" }])).toBeGreaterThanOrEqual(95);
  });

  it("ignores accents", () => {
    expect(scoreMatch("paranaque", [{ value: "Parañaque Hub" }])).not.toBeNull();
    expect(scoreMatch("muñoz", [{ value: "Munoz Trading" }])).not.toBeNull();
  });

  it("needs every word, in any field and any order", () => {
    const fields = [{ value: "KFC" }, ...code("ORD-482913-K7AN")];
    expect(scoreMatch("kfc 4829", fields)).not.toBeNull();
    expect(scoreMatch("4829 kfc", fields)).not.toBeNull();
    expect(scoreMatch("kfc jollibee", fields)).toBeNull();
  });

  it("counts a supporting field for less", () => {
    const main = scoreMatch("juan", [{ value: "Juan Hauling" }])!;
    const contact = scoreMatch("juan", [{ value: "Acme" }, { value: "Juan Reyes", secondary: true }])!;
    expect(main).toBeGreaterThan(contact);
  });
});

describe("reading what kind of thing was typed", () => {
  it("tells codes from names", () => {
    expect(queryShape("ORD-4829")).toBe("code");
    expect(queryShape("1234")).toBe("code");
    expect(queryShape("ABC 1234")).toBe("code");
    expect(queryShape("kfc")).toBe("name");
    expect(queryShape("k7an")).toBe("mixed");
  });

  it("keeps only the part of a code after its prefix", () => {
    expect(codeRemainder("or")).toBeNull();
    expect(codeRemainder("ORD-")).toBeNull();
    expect(codeRemainder("ord-12")).toBe("12");
    expect(codeRemainder("ordonez")).toBe("ordonez");
  });
});

describe("the database filters", () => {
  it("asks for word starts only for two characters", () => {
    expect(likeClauses("company", "an")).toEqual([
      'company.ilike."an%"',
      'company.ilike."% an%"',
      'company.ilike."%-an%"',
    ]);
  });

  it("also asks for a plate typed without its space", () => {
    expect(likeClauses("plateNumber", "abc1234")).toContain('plateNumber.ilike."%abc%1234%"');
  });

  it("never matches order codes on the prefix alone", () => {
    expect(orderCodeClauses("ord")).toEqual([]);
    expect(orderCodeClauses("48")[0]).toBe('orderCode.ilike."ORD-48%"');
  });
});

describe("ranking the list", () => {
  const r = (type: "client" | "booking" | "truck", id: string) => ({
    id,
    type,
    title: id,
    subtitle: "",
    href: "/",
  });

  it("orders kinds by their best match, not a fixed order", () => {
    const ranked = rankResults([
      { result: r("client", "c1"), score: 20 },
      { result: r("booking", "b1"), score: 80 },
      { result: r("client", "c2"), score: 60 },
    ]);
    expect(ranked.map((x) => x.id)).toEqual(["b1", "c2", "c1"]);
  });

  it("lifts a single exact match to the top", () => {
    const ranked = rankResults([
      { result: r("client", "c1"), score: 60 },
      { result: r("truck", "t1"), score: 100 },
    ]);
    expect(ranked[0]).toMatchObject({ id: "t1", top: true });
  });

  it("does not crown one of two exact matches", () => {
    const ranked = rankResults([
      { result: r("client", "c1"), score: 100 },
      { result: r("truck", "t1"), score: 100 },
    ]);
    expect(ranked.some((x) => x.top)).toBe(false);
  });

  it("caps each kind and the whole list", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ result: r("client", `c${i}`), score: 50 }));
    expect(rankResults(many)).toHaveLength(4);
    const mixed = ["client", "booking", "truck"].flatMap((type) =>
      Array.from({ length: 6 }, (_, i) => ({ result: r(type as "client", `${type}${i}`), score: 50 })),
    );
    expect(rankResults(mixed, { perGroup: 6, total: 12 })).toHaveLength(12);
  });
});
