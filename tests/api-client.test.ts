import { describe, expect, test } from "vitest";
import {
  buildApiUrl,
  getApiBaseUrl,
  mapBackendJob,
  modeToBackendMode,
  requireApiBaseUrl
} from "@/lib/api-client";

describe("api client", () => {
  test("defaults to the Vercel backend rewrite", () => {
    expect(getApiBaseUrl("")).toBe("/api/backend");
    expect(requireApiBaseUrl(undefined)).toBe("/api/backend");
  });

  test("normalizes backend URLs without duplicate slashes", () => {
    expect(buildApiUrl("https://api.fengye-rain.life/", "/api/jobs/abc")).toBe(
      "https://api.fengye-rain.life/api/jobs/abc"
    );
  });

  test("maps UI mode to backend mode", () => {
    expect(modeToBackendMode("balanced")).toBe("balanced");
    expect(modeToBackendMode("quality")).toBe("quality");
    expect(modeToBackendMode("convert")).toBe("convert");
  });

  test("maps backend job payload to the frontend job shape", () => {
    expect(
      mapBackendJob(
        {
          jobId: "job-1",
          status: "processing",
          progress: 42,
          message: "Separating",
          outputs: {
            vocals: "/api/jobs/job-1/download/vocals",
            instrumental: "/api/jobs/job-1/download/instrumental",
            guitar: "/api/jobs/job-1/download/guitar",
            no_guitar: "/api/jobs/job-1/download/no_guitar"
          }
        },
        "https://api.fengye-rain.life"
      )
    ).toMatchObject({
      id: "job-1",
      status: "running",
      progress: 42,
      message: "Separating",
      files: {
        isolated: {
          label: "吉他轨道",
          url: "https://api.fengye-rain.life/api/jobs/job-1/download/guitar"
        },
        backing: {
          label: "去吉他伴奏",
          url: "https://api.fengye-rain.life/api/jobs/job-1/download/no_guitar"
        }
      }
    });
  });

  test("maps target-based backend outputs to the frontend job shape", () => {
    expect(
      mapBackendJob(
        {
          jobId: "job-2",
          status: "completed",
          target: "guitar",
          targetLabel: "电吉他",
          mode: "balanced",
          format: "mp3",
          bitrate: 256,
          isolated: {
            label: "电吉他轨道",
            url: "/outputs/job-2/guitar.mp3"
          },
          backing: {
            label: "去吉他伴奏",
            url: "/outputs/job-2/no_guitar.mp3"
          }
        },
        "https://api.fengye-rain.life"
      )
    ).toMatchObject({
      id: "job-2",
      status: "completed",
      progress: 100,
      target: "guitar",
      targetLabel: "电吉他",
      files: {
        isolated: {
          label: "电吉他轨道",
          url: "https://api.fengye-rain.life/outputs/job-2/guitar.mp3"
        },
        backing: {
          label: "去吉他伴奏",
          url: "https://api.fengye-rain.life/outputs/job-2/no_guitar.mp3"
        }
      }
    });
  });

  test("maps convert backend output to the frontend job shape", () => {
    expect(
      mapBackendJob(
        {
          jobId: "job-3",
          status: "completed",
          mode: "convert",
          format: "mp3",
          bitrate: 320,
          converted: {
            label: "MP3 文件",
            url: "/outputs/job-3/demo-converted.mp3"
          }
        },
        "https://api.fengye-rain.life",
        "demo.ncm",
        "convert"
      )
    ).toMatchObject({
      id: "job-3",
      mode: "convert",
      status: "completed",
      progress: 100,
      files: {
        converted: {
          label: "MP3 文件",
          url: "https://api.fengye-rain.life/outputs/job-3/demo-converted.mp3"
        }
      }
    });
  });

  test("keeps backend conversion error codes", () => {
    expect(
      mapBackendJob(
        {
          jobId: "job-4",
          status: "failed",
          mode: "convert",
          message: "NCM 文件转换失败，请更换文件后重试。",
          errorCode: "NCM_CONVERSION_FAILED"
        },
        "https://api.fengye-rain.life",
        "demo.ncm",
        "convert"
      )
    ).toMatchObject({
      id: "job-4",
      mode: "convert",
      status: "failed",
      error: "NCM 文件转换失败，请更换文件后重试。",
      errorCode: "NCM_CONVERSION_FAILED"
    });
  });
});
