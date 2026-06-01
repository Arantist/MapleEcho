import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_JOBS_ROOT } from "@/lib/paths";
import type { JobMode, JobPaths, JobRecord, JobStatus } from "@/lib/types";

export function resolveJobPaths(jobId: string, rootDir = DEFAULT_JOBS_ROOT, extension = "mp3"): JobPaths {
  const jobDir = join(rootDir, jobId);
  const inputDir = join(jobDir, "input");
  const resultDir = join(jobDir, "result");
  const logsDir = join(jobDir, "logs");

  return {
    jobDir,
    inputDir,
    resultDir,
    logsDir,
    tempOutputDir: join(jobDir, "demucs-tmp"),
    inputFile: join(inputDir, `original.${extension}`),
    jobFile: join(jobDir, "job.json"),
    vocalsFile: join(resultDir, "vocals.mp3"),
    instrumentalFile: join(resultDir, "instrumental.mp3"),
    guitarFile: join(resultDir, "guitar.mp3"),
    noGuitarFile: join(resultDir, "no_guitar.mp3"),
    workerLog: join(logsDir, "worker.log")
  };
}

export async function createJob(input: {
  rootDir?: string;
  fileName: string;
  extension: string;
  input: Buffer;
  mode: JobMode;
}): Promise<JobRecord> {
  const rootDir = input.rootDir ?? DEFAULT_JOBS_ROOT;
  const id = randomUUID();
  const paths = resolveJobPaths(id, rootDir, input.extension);
  const now = new Date().toISOString();
  const job: JobRecord = {
    id,
    originalName: input.fileName,
    extension: input.extension,
    mode: input.mode,
    status: "queued",
    progress: 5,
    createdAt: now,
    updatedAt: now
  };

  await mkdir(paths.inputDir, { recursive: true });
  await mkdir(paths.resultDir, { recursive: true });
  await mkdir(paths.logsDir, { recursive: true });
  await writeFile(paths.inputFile, input.input);
  await writeJob(job, rootDir);
  return job;
}

export async function getJob(id: string, rootDir = DEFAULT_JOBS_ROOT): Promise<JobRecord | null> {
  try {
    const data = await readFile(resolveJobPaths(id, rootDir).jobFile, "utf8");
    return JSON.parse(data) as JobRecord;
  } catch {
    return null;
  }
}

export async function updateJob(id: string, patch: Partial<Omit<JobRecord, "id" | "createdAt">>, rootDir = DEFAULT_JOBS_ROOT) {
  const job = await getJob(id, rootDir);
  if (!job) {
    throw new Error(`Job ${id} not found`);
  }
  const updated: JobRecord = {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  await writeJob(updated, rootDir);
  return updated;
}

export async function findRunningJob(rootDir = DEFAULT_JOBS_ROOT): Promise<JobRecord | null> {
  return findJobByStatus(["running"], rootDir);
}

export async function findActiveJob(rootDir = DEFAULT_JOBS_ROOT): Promise<JobRecord | null> {
  return findJobByStatus(["queued", "running"], rootDir);
}

export async function writeJob(job: JobRecord, rootDir = DEFAULT_JOBS_ROOT) {
  const paths = resolveJobPaths(job.id, rootDir);
  await mkdir(paths.jobDir, { recursive: true });
  await writeFile(paths.jobFile, `${JSON.stringify(job, null, 2)}\n`);
}

async function findJobByStatus(statuses: JobStatus[], rootDir: string): Promise<JobRecord | null> {
  let entries: string[];
  try {
    entries = await readdir(rootDir);
  } catch {
    return null;
  }

  for (const entry of entries) {
    const job = await getJob(entry, rootDir);
    if (job && statuses.includes(job.status)) {
      return job;
    }
  }
  return null;
}
