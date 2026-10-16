import { describe, expect, it } from "vitest";
import { checkEmail, isValidEmailSyntax, suggestDomain } from "@/lib/checks/email";

describe("email check", () => {
  it("suggests gmail.com for gmial.com", async () => {
    expect(suggestDomain("gmial.com")).toBe("gmail.com");
    const { data } = await checkEmail("ali@gmial.com");
    expect(data.did_you_mean).toBe("ali@gmail.com");
  });

  it("suggests hotmail.com for hotmial.com", () => {
    expect(suggestDomain("hotmial.com")).toBe("hotmail.com");
  });

  it("flags mailinator.com as disposable", async () => {
    const { data } = await checkEmail("test@mailinator.com");
    expect(data.disposable).toBe(true);
    expect(["high", "critical", "medium"]).toContain(data.risk);
  });

  it("detects role and free provider addresses", async () => {
    const { data } = await checkEmail("support@gmail.com");
    expect(data.role_based).toBe(true);
    expect(data.free_provider).toBe(true);
    expect(data.did_you_mean).toBeNull();
  });

  it("validates syntax", () => {
    expect(isValidEmailSyntax("a.b+tag@example.co.uk")).toBe(true);
    expect(isValidEmailSyntax("no-at-sign")).toBe(false);
    expect(isValidEmailSyntax("a@b")).toBe(false);
    expect(isValidEmailSyntax("a..b@example.com")).toBe(false);
  });

  it("uses MX results and degrades to partial on lookup failure", async () => {
    const noMx = await checkEmail("ali@example.org", async () => false);
    expect(noMx.data.has_mx).toBe(false);
    expect(noMx.sources).toContain("mx");
    const failing = await checkEmail("ali@example.org", async () => {
      throw new Error("timeout");
    });
    expect(failing.partial).toBe(true);
    expect(failing.data.has_mx).toBeNull();
  });
});
