import { describe, expect, it } from "vitest";
import { ISecureError, ISecurePasswordValidationError, validateRegistrationPassword } from "../index.js";

describe("registration password validation", () => {
  it("accepts exactly 20 characters and counts Unicode code points rather than UTF-16 units", () => {
    expect(() => {
      validateRegistrationPassword("Aa1!" + "x".repeat(16));
    }).not.toThrow();
    expect(() => {
      validateRegistrationPassword("Aa1!" + "😀".repeat(16));
    }).not.toThrow();
    expect(() => {
      validateRegistrationPassword("Aa1!" + "😀".repeat(15));
    }).toThrow("Use at least 20 characters.");
  });

  it("reports all missing requirements without retaining the password", () => {
    const password = "synthetic";
    let caught: unknown;
    try {
      validateRegistrationPassword(password);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ISecureError);
    expect(caught).toBeInstanceOf(ISecurePasswordValidationError);
    expect(caught).toMatchObject({
      issues: ["too_short", "missing_uppercase", "missing_number", "missing_symbol"],
      requestId: undefined,
    });
    expect(String(caught)).not.toContain(password);
    expect(JSON.stringify(caught)).not.toContain(password);
  });

  it("reports every requirement for an empty password", () => {
    expect(() => {
      validateRegistrationPassword("");
    }).toThrow(
      "Use at least 20 characters. Include an uppercase letter (A-Z). Include a lowercase letter (a-z). Include a number (0-9). Include a special character",
    );
  });

  it.each(["!", "=", "\\", "`", "_", "]", " "])("accepts the supported interior symbol %j", (symbol) => {
    expect(() => {
      validateRegistrationPassword("Aa1" + symbol + "x".repeat(16));
    }).not.toThrow();
  });

  it.each(["Aa1" + "😀".repeat(17), " " + "Aa1" + "x".repeat(16), "Aa1" + "x".repeat(16) + " "])(
    "does not treat arbitrary Unicode or edge spaces as a required symbol",
    (password) => {
      expect(() => {
        validateRegistrationPassword(password);
      }).toThrow("Include a special character");
    },
  );

  it("keeps issue codes immutable independently of the caller's array", () => {
    const issues: ("too_short" | "missing_number")[] = ["too_short"];
    const error = new ISecurePasswordValidationError(issues);
    issues.push("missing_number");
    expect(error.issues).toEqual(["too_short"]);
    expect(Object.isFrozen(error.issues)).toBe(true);
  });
});
