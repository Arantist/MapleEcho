import { describe, expect, test } from "vitest";
import { isRecommendedPythonVersion, parseVersionLine } from "@/lib/system-check";

describe("system check helpers", () => {
  test("parses tool version output", () => {
    expect(parseVersionLine("Python 3.11.9")).toEqual({
      raw: "Python 3.11.9",
      major: 3,
      minor: 11,
      patch: 9
    });
  });

  test("recommends Python 3.11 or 3.12 for Demucs", () => {
    expect(isRecommendedPythonVersion({ major: 3, minor: 11, patch: 9, raw: "Python 3.11.9" })).toBe(true);
    expect(isRecommendedPythonVersion({ major: 3, minor: 12, patch: 4, raw: "Python 3.12.4" })).toBe(true);
    expect(isRecommendedPythonVersion({ major: 3, minor: 14, patch: 4, raw: "Python 3.14.4" })).toBe(false);
  });
});
