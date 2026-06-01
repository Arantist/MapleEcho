import { createWriteStream } from "node:fs";
import { DEFAULT_JOBS_ROOT, DEFAULT_PYTHON } from "@/lib/paths";
import { resolveJobPaths, updateJob } from "@/lib/jobs";
import type { JobMode } from "@/lib/types";
import { spawn } from "node:child_process";

export function modelForMode(_mode: JobMode) {
  return "htdemucs_6s";
}

export function buildWorkerArgs(input: {
  jobId: string;
  inputFile: string;
  resultDir: string;
  tempOutputDir: string;
  mode: JobMode;
  jobFile: string;
  workerLog: string;
}) {
  return [
    "worker/separate.py",
    "--job-id",
    input.jobId,
    "--input",
    input.inputFile,
    "--result-dir",
    input.resultDir,
    "--temp-output-dir",
    input.tempOutputDir,
    "--mode",
    input.mode,
    "--job-file",
    input.jobFile,
    "--worker-log",
    input.workerLog
  ];
}

export async function startSeparationJob(jobId: string, options: { rootDir?: string; pythonBin?: string } = {}) {
  const rootDir = options.rootDir ?? DEFAULT_JOBS_ROOT;
  const paths = resolveJobPaths(jobId, rootDir);
  const job = await updateJob(jobId, { status: "running", progress: 30 }, rootDir);
  const inputFile = resolveJobPaths(jobId, rootDir, job.extension).inputFile;
  const args = buildWorkerArgs({
    jobId,
    inputFile,
    resultDir: paths.resultDir,
    tempOutputDir: paths.tempOutputDir,
    mode: job.mode,
    jobFile: paths.jobFile,
    workerLog: paths.workerLog
  });
  const logStream = createWriteStream(paths.workerLog, { flags: "a" });
  const child = spawn(options.pythonBin ?? DEFAULT_PYTHON, args, {
    cwd: process.cwd(),
    detached: false,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.pipe(logStream, { end: false });
  child.stderr.pipe(logStream, { end: false });
  child.on("error", async (error) => {
    logStream.write(`\n[spawn error] ${error.message}\n`);
    logStream.end();
    await updateJob(jobId, { status: "failed", progress: 100, error: error.message }, rootDir);
  });
  child.on("close", async (code) => {
    logStream.write(`\n[worker exit] ${code}\n`);
    logStream.end();
    if (code !== 0) {
      const current = await updateJob(jobId, {}, rootDir).catch(() => null);
      if (current?.status !== "completed") {
        await updateJob(jobId, {
          status: "failed",
          progress: 100,
          error: `Worker exited with code ${code}`
        }, rootDir).catch(() => undefined);
      }
    }
  });
}
