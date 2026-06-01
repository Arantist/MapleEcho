import { describe, expect, test } from "vitest";
import { parseByteRange } from "@/lib/http-range";

describe("parseByteRange", () => {
  test("parses bounded and open-ended byte ranges", () => {
    expect(parseByteRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99, contentLength: 100 });
    expect(parseByteRange("bytes=500-", 1000)).toEqual({ start: 500, end: 999, contentLength: 500 });
  });

  test("parses suffix byte ranges", () => {
    expect(parseByteRange("bytes=-200", 1000)).toEqual({ start: 800, end: 999, contentLength: 200 });
    expect(parseByteRange("bytes=-2000", 1000)).toEqual({ start: 0, end: 999, contentLength: 1000 });
  });

  test("rejects invalid or unsatisfiable ranges", () => {
    expect(parseByteRange(null, 1000)).toBeNull();
    expect(parseByteRange("items=0-99", 1000)).toBeNull();
    expect(parseByteRange("bytes=1000-1200", 1000)).toBeNull();
    expect(parseByteRange("bytes=200-100", 1000)).toBeNull();
    expect(parseByteRange("bytes=0-1", 0)).toBeNull();
  });
});
