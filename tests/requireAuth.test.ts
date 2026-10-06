import { beforeEach, describe, expect, it, vi } from "vitest";

// Every API request is let in by requireAuth. The token is checked here, on the
// server, and the database says in the same lookup as the Employee row whether
// the token's session is still signed in - so a device signed out by a
// password change is refused on its next request.

const OFFICE = { employeeID: "e1", employeeName: "Office", role: "Admin", isActive: true };

const getClaims = vi.fn();
const getUser = vi.fn();
const rpc = vi.fn();
const employeeRow = vi.fn();

vi.mock("@/app/lib/supabaseAuth", () => ({ supabaseAuth: { auth: { getClaims, getUser } } }));
vi.mock("@/app/lib/supabase", () => ({
  supabase: {
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: employeeRow }) }) }),
  },
}));

const { requireAuth } = await import("@/app/lib/auth");

const withToken = () =>
  new Request("https://logisco.test/api/x", { headers: { Authorization: "Bearer t0ken" } });

const signedIn = { sub: "u1", session_id: "s1", email: "dan@logisco.company" };

beforeEach(() => {
  vi.resetAllMocks();
  getClaims.mockResolvedValue({ data: { claims: signedIn }, error: null });
});

describe("requireAuth", () => {
  it("lets a signed-in employee in, in one database call", async () => {
    rpc.mockResolvedValue({ data: { sessionActive: true, employee: OFFICE }, error: null });

    await expect(requireAuth(withToken())).resolves.toEqual({
      user: { id: "u1", email: "dan@logisco.company" },
      employee: OFFICE,
    });
    expect(rpc).toHaveBeenCalledWith("auth_session_employee", { p_auth_id: "u1", p_session_id: "s1" });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("refuses a request with no token", async () => {
    const response = await requireAuth(new Request("https://logisco.test/api/x"));
    expect(response).toMatchObject({ status: 401 });
  });

  it("refuses a token that does not check out", async () => {
    getClaims.mockResolvedValue({ data: null, error: { message: "invalid JWT" } });
    await expect(requireAuth(withToken())).resolves.toMatchObject({ status: 401 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a token whose session has been signed out", async () => {
    rpc.mockResolvedValue({ data: { sessionActive: false, employee: OFFICE }, error: null });
    await expect(requireAuth(withToken())).resolves.toMatchObject({ status: 401 });
  });

  it("refuses a login with no employee behind it", async () => {
    rpc.mockResolvedValue({ data: { sessionActive: true, employee: null }, error: null });
    await expect(requireAuth(withToken())).resolves.toMatchObject({ status: 404 });
  });

  it("refuses a deactivated employee", async () => {
    rpc.mockResolvedValue({
      data: { sessionActive: true, employee: { ...OFFICE, isActive: false } },
      error: null,
    });
    await expect(requireAuth(withToken())).resolves.toMatchObject({ status: 403 });
  });

  describe("before the migration is applied", () => {
    beforeEach(() => {
      rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "function not found" } });
    });

    it("checks the token with Supabase Auth as before", async () => {
      getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      employeeRow.mockResolvedValue({ data: OFFICE, error: null });

      await expect(requireAuth(withToken())).resolves.toMatchObject({ employee: OFFICE });
      expect(getUser).toHaveBeenCalledWith("t0ken");
    });

    it("still refuses a signed-out token", async () => {
      getUser.mockResolvedValue({ data: { user: null }, error: { message: "session not found" } });
      await expect(requireAuth(withToken())).resolves.toMatchObject({ status: 401 });
    });
  });
});
