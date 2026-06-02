import { describe, expect, test } from "vitest";
import { buildWorkerArgs, modelForMode } from "@/lib/separation";

describe("separation worker command", () => {
  test("maps speed and quality modes to the requested Demucs models", () => {
    expect(modelForMode("speed")).toBe("htdemucs_6s");
    expect(modelForMode("quality")).toBe("htdemucs_6s");
  });

  test("builds Python worker arguments without waiting for Demucs in the API layer", () => {
    const args = buildWorkerArgs({
      jobId: "job-123",
      inputFile: "/jobs/job-123/input/original.mp3",
      resultDir: "/jobs/job-123/result",
      tempOutputDir: "/jobs/job-123/demucs-tmp",
      mode: "quality",
      jobFile: "/jobs/job-123/job.json",
      workerLog: "/jobs/job-123/logs/worker.log"
    });

    expect(args).toEqual([
      "worker/separate.py",
      "--job-id",
      "job-123",
      "--input",
      "/jobs/job-123/input/original.mp3",
      "--result-dir",
      "/jobs/job-123/result",
      "--temp-output-dir",
      "/jobs/job-123/demucs-tmp",
      "--mode",
      "quality",
      "--job-file",
      "/jobs/job-123/job.json",
      "--worker-log",
      "/jobs/job-123/logs/worker.log"
    ]);
  });
});
