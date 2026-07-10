import { describe, expect, it } from "vitest";

import { isAbortError } from "./isAbortError";

describe("isAbortError", () => {
  it("recognizes abort DOM exceptions", () => {
    expect(isAbortError(new DOMException("Stopped", "AbortError"))).toBe(true);
  });

  it("recognizes errors named AbortError", () => {
    const error = new Error("Stopped");
    error.name = "AbortError";

    expect(isAbortError(error)).toBe(true);
  });

  it("rejects unrelated errors and values", () => {
    expect(isAbortError(new Error("Network down"))).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
  });
});
