import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import {
  createJob,
  findActiveJob,
  findRunningJob,
  getJob,
  resolveJobPaths,
  updateJob
} from "@/lib/jobs";

async function tempJobsRoot() {
  return mkdtemp(join(tmpdir(), "stem-jobs-"));
}

describe("job storage", () => {
  test("creates the required directory layout and queued job metadata", async () => {
    const rootDir = await tempJobsRoot();
    const job = await createJob({
      rootDir,
      fileName: "demo.wav",
      extension: "wav",
      input: Buffer.from("audio"),
      mode: "quality"
    });

    const paths = resolveJobPaths(job.id, rootDir, job.extension);
    const savedInput = await readFile(paths.inputFile);
    const savedJob = await getJob(job.id, rootDir);

    expect(savedInput).toEqual(Buffer.from("audio"));
    expect(paths.inputFile.endsWith("input/original.wav")).toBe(true);
    expect(paths.vocalsFile.endsWith("result/vocals.mp3")).toBe(true);
    expect(paths.instrumentalFile.endsWith("result/instrumental.mp3")).toBe(true);
    expect(paths.guitarFile.endsWith("result/guitar.mp3")).toBe(true);
    expect(paths.noGuitarFile.endsWith("result/no_guitar.mp3")).toBe(true);
    expect(paths.workerLog.endsWith("logs/worker.log")).toBe(true);
    expect(savedJob).toMatchObject({
      id: job.id,
      originalName: "demo.wav",
      mode: "quality",
      status: "queued",
      progress: 5
    });
  });

  test("updates job status and finds the only running job", async () => {
    const rootDir = await tempJobsRoot();
    const first = await createJob({
      rootDir,
      fileName: "one.mp3",
      extension: "mp3",
      input: Buffer.from("one"),
      mode: "speed"
    });
    const second = await createJob({
      rootDir,
      fileName: "two.mp3",
      extension: "mp3",
      input: Buffer.from("two"),
      mode: "quality"
    });

    await updateJob(first.id, { status: "running", progress: 30 }, rootDir);
    await updateJob(second.id, { status: "failed", progress: 100, error: "boom" }, rootDir);

    const running = await findRunningJob(rootDir);
    expect(running?.id).toBe(first.id);
    expect((await getJob(second.id, rootDir))?.error).toBe("boom");
  });

  test("treats queued and running jobs as active for upload throttling", async () => {
    const rootDir = await tempJobsRoot();
    const queued = await createJob({
      rootDir,
      fileName: "queued.mp3",
      extension: "mp3",
      input: Buffer.from("queued"),
      mode: "speed"
    });

    expect((await findActiveJob(rootDir))?.id).toBe(queued.id);

    await updateJob(queued.id, { status: "completed", progress: 100 }, rootDir);
    expect(await findActiveJob(rootDir)).toBeNull();
  });
});
