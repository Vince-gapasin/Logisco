import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Wrong passwords are counted per email, because the server is the only
// address Supabase ever sees and its own limit cannot tell people apart.

const db = supabaseDouble();

vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const { MAX_FAILED_SIGN_INS, clearFailedSignIns, recordFailedSignIn, signInIsLocked } = await import(
  "@/services/auth/loginThrottleService"
);

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("counting failed sign-ins", () => {
  it("lets someone in below the limit", async () => {
    db.queue({ count: MAX_FAILED_SIGN_INS - 1 });
    await expect(signInIsLocked("dan@logisco.company")).resolves.toBe(false);
  });

  it("makes them wait at the limit", async () => {
    db.queue({ count: MAX_FAILED_SIGN_INS });
    await expect(signInIsLocked("dan@logisco.company")).resolves.toBe(true);
  });

  it("never locks anyone out because the count could not be read", async () => {
    // A missing table, before the migration is applied, must not stop sign-in.
    db.queue({ error: { message: 'relation "LoginAttempt" does not exist' } });
    await expect(signInIsLocked("dan@logisco.company")).resolves.toBe(false);
  });

  it("counts an address however it was typed", async () => {
    await recordFailedSignIn("  Dan@Logisco.Company ");
    expect(db.writes[0]).toMatchObject({ table: "LoginAttempt", payload: { email: "dan@logisco.company" } });
  });

  it("clears out failures older than the window as new ones arrive", async () => {
    await recordFailedSignIn("dan@logisco.company");
    expect(db.writes.map((write) => write.chain[0])).toEqual(["insert", "delete"]);
  });

  it("starts the count again on a right password", async () => {
    await clearFailedSignIns("dan@logisco.company");
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0].chain[0]).toBe("delete");
  });
});
