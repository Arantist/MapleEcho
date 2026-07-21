import { describe, expect, test } from "vitest";
import {
  clampLoopPoint,
  clampPitchSemitones,
  clampPlaybackRate,
  clampPlaybackTime,
  defaultPracticeTrackMap,
  formatPlaybackTime,
  hasValidLoop,
  progressPercent
} from "@/lib/player";

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

  test("maps every separated target to its default backing practice track", () => {
    expect(defaultPracticeTrackMap).toEqual({
      guitar: "no_guitar",
      bass: "no_bass",
      drums: "no_drums",
      vocals: "no_vocals"
    });
  });

  test("clamps practice speed and pitch to the supported ranges", () => {
    expect(clampPlaybackRate(0.2)).toBe(0.5);
    expect(clampPlaybackRate(1.234)).toBe(1.25);
    expect(clampPlaybackRate(3)).toBe(1.5);
    expect(clampPlaybackRate(Number.NaN)).toBe(1);
    expect(clampPitchSemitones(-12)).toBe(-6);
    expect(clampPitchSemitones(2.6)).toBe(3);
    expect(clampPitchSemitones(10)).toBe(6);
  });

  test("validates AB loop boundaries against the audio duration", () => {
    expect(clampLoopPoint(-2, 60)).toBe(0);
    expect(clampLoopPoint(80, 60)).toBe(60);
    expect(hasValidLoop(5, 12, 60)).toBe(true);
    expect(hasValidLoop(5, 5.05, 60)).toBe(false);
    expect(hasValidLoop(20, 12, 60)).toBe(false);
    expect(hasValidLoop(5, 70, 60)).toBe(false);
  });
});
