export type JobMode = "speed" | "quality";
export type JobStatus = "queued" | "running" | "completed" | "failed";
export type StemName = "vocals" | "instrumental" | "guitar" | "no_guitar";

export type JobFileLinks = {
  vocals?: string;
  instrumental?: string;
  guitar?: string;
  no_guitar?: string;
};

export type JobRecord = {
  id: string;
  originalName: string;
  extension: string;
  mode: JobMode;
  status: JobStatus;
  progress: number;
  error?: string;
  warning?: string;
  device?: "mps" | "cpu";
  files?: JobFileLinks;
  createdAt: string;
  updatedAt: string;
};

export type JobPaths = {
  jobDir: string;
  inputDir: string;
  resultDir: string;
  logsDir: string;
  tempOutputDir: string;
  inputFile: string;
  jobFile: string;
  vocalsFile: string;
  instrumentalFile: string;
  guitarFile: string;
  noGuitarFile: string;
  workerLog: string;
};
