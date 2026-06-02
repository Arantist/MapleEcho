import { describe, expect, test } from "vitest";
import {
  API_CONFIGURATION_ERROR,
  buildApiUrl,
  mapBackendJob,
  modeToBackendMode,
  requireApiBaseUrl
} from "@/lib/api-client";

describe("api client", () => {
  test("requires NEXT_PUBLIC_API_BASE_URL", () => {
    expect(() => requireApiBaseUrl("")).toThrow(API_CONFIGURATION_ERROR);
    expect(() => requireApiBaseUrl(undefined)).toThrow(API_CONFIGURATION_ERROR);
  });

  test("normalizes backend URLs without duplicate slashes", () => {
    expect(buildApiUrl("https://audio-backend.onrender.com/", "/api/jobs/abc")).toBe(
      "https://audio-backend.onrender.com/api/jobs/abc"
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
        "https://audio-backend.onrender.com"
      )
    ).toMatchObject({
      id: "job-1",
      status: "running",
      progress: 42,
      message: "Separating",
      files: {
        vocals: "https://audio-backend.onrender.com/api/jobs/job-1/download/vocals",
        instrumental: "https://audio-backend.onrender.com/api/jobs/job-1/download/instrumental",
        guitar: "https://audio-backend.onrender.com/api/jobs/job-1/download/guitar",
        no_guitar: "https://audio-backend.onrender.com/api/jobs/job-1/download/no_guitar"
      }
    });
  });
});
