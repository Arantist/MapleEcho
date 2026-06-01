import { describe, expect, test } from "vitest";
import { clampPlaybackTime, formatPlaybackTime, progressPercent } from "@/lib/player";

describe("audio player helpers", () => {
  test("formats finite playback seconds as minutes and seconds", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(7.9)).toBe("0:07");
    expect(formatPlaybackTime(264)).toBe("4:24");
    expect(formatPlaybackTime(Number.NaN)).toBe("0:00");
    expect(formatPlaybackTime(Number.POSITIVE_INFINITY)).toBe("0:00");
  });

  test("clamps requested seek time to the playable duration", () => {
    expect(clampPlaybackTime(-4, 264)).toBe(0);
    expect(clampPlaybackTime(90, 264)).toBe(90);
    expect(clampPlaybackTime(900, 264)).toBe(264);
    expect(clampPlaybackTime(50, Number.NaN)).toBe(0);
  });

  test("calculates the filled progress percentage for the range track", () => {
    expect(progressPercent(0, 264)).toBe(0);
    expect(progressPercent(132, 264)).toBe(50);
    expect(progressPercent(300, 264)).toBe(100);
    expect(progressPercent(20, 0)).toBe(0);
  });
});
