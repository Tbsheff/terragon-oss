import { describe, it, expect } from "vitest";

describe("Vitest setup", () => {
  it("should run basic tests", () => {
    expect(1 + 1).toBe(2);
  });

  it("should support path aliases", async () => {
    // Test that @ alias resolves correctly by actually importing a module
    const { APP_NAME } = await import("@/lib/constants");
    expect(APP_NAME).toBe("OpenClaw Dashboard");
  });
});
