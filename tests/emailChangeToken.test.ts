import { beforeAll, describe, expect, it } from "vitest";

// The link that proves somebody can read the address they are moving to.
//
// Changing a login email used to take effect on the spot, marked confirmed by
// the server without anybody proving control of the new address. A typo moved
// the account to a mailbox that may not exist, or to a stranger's, with no way
// back: signing in to fix it needs the address you can no longer read.
//
// The token is now the whole credential for that change, so what it refuses
// matters as much as what it carries.

beforeAll(() => {
  process.env.SUPABASE_SECRET_KEY = "test-service-role-key";
});

const {
  createEmailChangeToken,
  readEmailChangeToken,
  EMAIL_CHANGE_VALID_FOR_MS,
} = await import("@/app/lib/emailChangeToken");

const CLAIM = {
  employeeID: "11111111-2222-3333-4444-555555555555",
  newEmail: "new@example.com",
  fromEmail: "old@example.com",
};

const NOW = Date.UTC(2026, 9, 1, 9, 0, 0);

describe("a token the holder of the new address hands back", () => {
  it("carries who is moving, and where from and to", () => {
    const check = readEmailChangeToken(createEmailChangeToken(CLAIM, NOW), NOW);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.claim).toMatchObject(CLAIM);
  });

  it("is good for half an hour and not a minute more", () => {
    const token = createEmailChangeToken(CLAIM, NOW);

    expect(readEmailChangeToken(token, NOW + EMAIL_CHANGE_VALID_FOR_MS - 1).ok).toBe(true);

    const expired = readEmailChangeToken(token, NOW + EMAIL_CHANGE_VALID_FOR_MS);
    expect(expired.ok).toBe(false);
    if (expired.ok) return;
    expect(expired.reason).toBe("expired");
  });

  it("carries its own expiry, so moving the clock back does not extend it", () => {
    // The deadline is inside the signed payload rather than beside it, which is
    // the reason nothing has to be stored between the request and the click.
    const token = createEmailChangeToken(CLAIM, NOW);
    const tampered = token.replace(/^[^.]+/, (payload) => {
      const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      claim.expiresAt = NOW + 10 * 365 * 24 * 3600 * 1000;
      return Buffer.from(JSON.stringify(claim), "utf8").toString("base64url");
    });

    const check = readEmailChangeToken(tampered, NOW);
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.reason).toBe("forged");
  });
});

describe("what it refuses", () => {
  it("refuses a payload somebody rewrote", () => {
    // The attack worth naming: point an otherwise valid request at a different
    // address.
    const token = createEmailChangeToken(CLAIM, NOW);
    const swapped = token.replace(/^[^.]+/, () =>
      Buffer.from(
        JSON.stringify({ ...CLAIM, newEmail: "attacker@example.com", expiresAt: NOW + 60_000 }),
        "utf8",
      ).toString("base64url"),
    );

    const check = readEmailChangeToken(swapped, NOW);
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.reason).toBe("forged");
  });

  it("refuses a signature that is merely the right shape", () => {
    const token = createEmailChangeToken(CLAIM, NOW);
    const [payload, signature] = token.split(".");
    const flipped = signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A");
    expect(readEmailChangeToken(`${payload}.${flipped}`, NOW).ok).toBe(false);
  });

  it("refuses anything that is not a token at all", () => {
    for (const nonsense of ["", ".", "abc", "no-dot-here"]) {
      expect(readEmailChangeToken(nonsense, NOW).ok).toBe(false);
    }
  });

  it("tells a forgery from an expiry only after the signature holds", () => {
    // An expired token says "expired" because it was genuinely issued here;
    // anything unsigned says "forged" however old it claims to be.
    const real = createEmailChangeToken(CLAIM, NOW);
    const expired = readEmailChangeToken(real, NOW + EMAIL_CHANGE_VALID_FOR_MS);
    expect(expired.ok || expired.reason).toBe("expired");

    const unsigned = Buffer.from(
      JSON.stringify({ ...CLAIM, expiresAt: NOW - 1 }),
      "utf8",
    ).toString("base64url");
    const forged = readEmailChangeToken(`${unsigned}.notasignature`, NOW);
    expect(forged.ok || forged.reason).toBe("forged");
  });
});

describe("what pins a link to one request", () => {
  it("records the address being left, so a stale link cannot be reopened later", () => {
    // Ask twice, change once: the first link still verifies, and the route
    // compares fromEmail against the address on file to refuse it.
    const first = createEmailChangeToken(CLAIM, NOW);
    const check = readEmailChangeToken(first, NOW);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.claim.fromEmail).toBe("old@example.com");
  });

  it("gives two requests different tokens", () => {
    expect(createEmailChangeToken(CLAIM, NOW)).not.toBe(createEmailChangeToken(CLAIM, NOW + 1000));
  });
});
