import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone } from "@/app/lib/mask";

describe("showing a contact detail without giving it away", () => {
  it("keeps the start of an email and its domain", () => {
    expect(maskEmail("logisco.system@gmail.com")).toBe("lo••••••••••••@gmail.com");
    expect(maskEmail("ana@acme.com.ph")).toBe("an•••@acme.com.ph");
  });

  it("keeps the network and the last four digits of a number", () => {
    expect(maskPhone("09171234567")).toBe("0917•••4567");
    expect(maskPhone("0917-123-4567")).toBe("0917•••4567");
  });

  it("never returns something that could be dialled or written to", () => {
    expect(maskEmail("logisco.system@gmail.com")).not.toContain("logisco.system");
    expect(maskPhone("09171234567")).not.toContain("123456");
  });

  it("gives nothing back when there is nothing to show", () => {
    expect(maskEmail("")).toBeNull();
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail("not-an-email")).toBeNull();
    expect(maskEmail("@nolocalpart.com")).toBeNull();
    expect(maskPhone("123")).toBeNull();
    expect(maskPhone(undefined)).toBeNull();
  });
});
