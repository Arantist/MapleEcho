export type JobMode = "balanced" | "quality";
export type JobStatus = "queued" | "running" | "completed" | "failed";
export type TargetStem = "guitar" | "bass" | "drums" | "vocals";
export type StemName = "isolated" | "backing";
export type BackendJobMode = "balanced" | "quality";
export type BackendJobStatus = "queued" | "processing" | "completed" | "failed";

export type JobFileLink = {
  label: string;
  url: string;
};

export type JobFileLinks = {
  isolated?: JobFileLink;
  backing?: JobFileLink;
};

export type JobRecord = {
  id: string;
  originalName: string;
  extension: string;
  mode: JobMode;
  status: JobStatus;
  progress: number;
  message?: string;
  error?: string;
  warning?: string;
  device?: "mps" | "cpu";
  target?: TargetStem;
  targetLabel?: string;
  format?: "mp3";
  bitrate?: number;
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

export type BackendJobResponse = {
  jobId: string;
  status: BackendJobStatus;
  progress?: number;
  message?: string;
  target?: TargetStem;
  targetLabel?: string;
  mode?: BackendJobMode;
  format?: "mp3";
  bitrate?: number;
  isolated?: JobFileLink;
  backing?: JobFileLink;
  outputs?: {
    vocals?: string;
    instrumental?: string;
    guitar?: string;
    no_guitar?: string;
  };
};

export type BackendHealth = {
  ok: boolean;
  service: "audio-separation-backend";
  ffmpeg: boolean;
  ffprobe: boolean;
  python: boolean;
  demucs: boolean;
  torch?: boolean;
  cpuCores?: number;
  memoryGb?: number;
  model?: string;
  supportedTargets?: TargetStem[];
};
