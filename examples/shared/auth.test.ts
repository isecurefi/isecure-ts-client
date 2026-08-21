import { afterEach, describe, expect, it, vi } from "vitest";
import { configFromEnv } from "./auth.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("example authentication configuration", () => {
  it("honors an explicitly selected role identity without requiring shared credentials", () => {
    vi.stubEnv("ISECURE_COMPANY", "Synthetic Company");
    vi.stubEnv("ISECURE_NAME", "Synthetic User");
    vi.stubEnv("ISECURE_PHONE", "+358401234567");
    vi.stubEnv("ISECURE_PUBLIC_KEY_PEM", "synthetic-public-key");

    const result = configFromEnv({
      Email: "selected@example.test",
      Password: "selected-password",
      Mode: "admin",
    });

    expect(result.Email).toBe("selected@example.test");
    expect(result.Password).toBe("selected-password");
    expect(result.Mode).toBe("admin");
  });
});
