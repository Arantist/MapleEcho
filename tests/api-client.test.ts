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

  test("maps UI speed mode to backend fast mode", () => {
    expect(modeToBackendMode("speed")).toBe("fast");
    expect(modeToBackendMode("quality")).toBe("quality");
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
        vocals: "https://api.fengye-rain.life/api/jobs/job-1/download/vocals",
        instrumental: "https://api.fengye-rain.life/api/jobs/job-1/download/instrumental",
        guitar: "https://api.fengye-rain.life/api/jobs/job-1/download/guitar",
        no_guitar: "https://api.fengye-rain.life/api/jobs/job-1/download/no_guitar"
      }
    });
  });
});
