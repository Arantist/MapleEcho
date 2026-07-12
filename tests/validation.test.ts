import { describe, expect, test } from "vitest";
import { validateUploadMetadata } from "@/lib/validation";

describe("validateUploadMetadata", () => {
  test("accepts one supported audio file under the size limit", () => {
    const result = validateUploadMetadata({
      fileName: "practice-track.MP3",
      fileSize: 1024 * 1024,
      mode: "balanced"
    });

    expect(result).toEqual({ ok: true, extension: "mp3", mode: "balanced" });
  });

  test("accepts ncm files and convert mode", () => {
    const result = validateUploadMetadata({
      fileName: "cloud-track.NCM",
      fileSize: 1024 * 1024,
      mode: "convert"
    });

    expect(result).toEqual({ ok: true, extension: "ncm", mode: "convert" });
  });

  test("rejects unsupported extensions", () => {
    const result = validateUploadMetadata({
      fileName: "notes.txt",
      fileSize: 1000,
      mode: "quality"
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "仅支持 mp3、wav、flac、m4a、aac、ogg、ncm 音频文件。"
    });
  });

  test("rejects files over 100MB", () => {
    const result = validateUploadMetadata({
      fileName: "large.wav",
      fileSize: 101 * 1024 * 1024,
      mode: "balanced"
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "文件不能超过 100MB。"
    });
  });

  test("rejects unknown modes", () => {
    const result = validateUploadMetadata({
      fileName: "song.wav",
      fileSize: 1000,
      mode: "speed"
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "处理模式只能是 balanced、quality 或 convert。"
    });
  });
});
