import type { PracticeTrackId, TargetStem } from "@/lib/types";

export const defaultPracticeTrackMap: Record<TargetStem, PracticeTrackId> = {
  guitar: "no_guitar",
  bass: "no_bass",
  drums: "no_drums",
  vocals: "no_vocals"
};

export function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function clampPlaybackTime(seconds: number, duration: number) {
  if (!Number.isFinite(seconds) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(Math.max(seconds, 0), duration);
}

export function progressPercent(currentTime: number, duration: number) {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(Math.max((currentTime / duration) * 100, 0), 100);
}

export function clampPlaybackRate(rate: number) {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(Math.max(Math.round(rate * 20) / 20, 0.5), 1.5);
}

export function clampPitchSemitones(semitones: number) {
  if (!Number.isFinite(semitones)) return 0;
  return Math.min(Math.max(Math.round(semitones), -6), 6);
}

export function clampLoopPoint(seconds: number, duration: number) {
  return clampPlaybackTime(seconds, duration);
}

export function hasValidLoop(start: number, end: number, duration: number) {
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    Number.isFinite(duration) &&
    duration > 0 &&
    start >= 0 &&
    end <= duration &&
    end - start >= 0.1
  );
}
