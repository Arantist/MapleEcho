import type { BackendHealth, BackendJobMode, BackendJobResponse, JobMode, JobRecord, JobStatus } from "@/lib/types";

export const API_CONFIGURATION_ERROR = "请先配置 NEXT_PUBLIC_API_BASE_URL。";
export const API_UNAVAILABLE_ERROR = "后端服务不可用，请检查 Render 服务是否启动或环境变量是否配置正确。";

export function requireApiBaseUrl(value = process.env.NEXT_PUBLIC_API_BASE_URL) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(API_CONFIGURATION_ERROR);
  }
  return trimmed.replace(/\/+$/, "");
}

export function buildApiUrl(baseUrl: string, path: string) {
  const base = requireApiBaseUrl(baseUrl);
  return `${base}/${path.replace(/^\/+/, "")}`;
}

export function modeToBackendMode(mode: JobMode): BackendJobMode {
  return mode === "speed" ? "fast" : "quality";
}

export async function fetchBackendHealth(baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL): Promise<BackendHealth> {
  const response = await fetch(buildApiUrl(requireApiBaseUrl(baseUrl), "/health"));
  if (!response.ok) {
    throw new Error(API_UNAVAILABLE_ERROR);
  }
  return response.json();
}

export async function createBackendJob(input: {
  file: File;
  mode: JobMode;
  baseUrl?: string;
}): Promise<JobRecord> {
  const apiBaseUrl = requireApiBaseUrl(input.baseUrl);
  const form = new FormData();
  form.append("file", input.file);

  const response = await fetch(buildApiUrl(apiBaseUrl, `/api/jobs?mode=${modeToBackendMode(input.mode)}`), {
    method: "POST",
    body: form
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.detail || API_UNAVAILABLE_ERROR);
  }
  return mapBackendJob(payload, apiBaseUrl, input.file.name, input.mode);
}

export async function fetchBackendJob(jobId: string, baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL): Promise<JobRecord> {
  const apiBaseUrl = requireApiBaseUrl(baseUrl);
  const response = await fetch(buildApiUrl(apiBaseUrl, `/api/jobs/${jobId}`));
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.detail || API_UNAVAILABLE_ERROR);
  }
  return mapBackendJob(payload, apiBaseUrl);
}

export function mapBackendJob(
  payload: BackendJobResponse,
  baseUrl: string,
  originalName = "",
  mode: JobMode = "speed"
): JobRecord {
  const now = new Date().toISOString();
  return {
    id: payload.jobId,
    originalName,
    extension: originalName.split(".").pop()?.toLowerCase() || "",
    mode,
    status: mapBackendStatus(payload.status),
    progress: payload.progress ?? (payload.status === "completed" ? 100 : 0),
    message: payload.message,
    error: payload.status === "failed" ? payload.message : undefined,
    files: {
      vocals: payload.outputs?.vocals ? buildApiUrl(baseUrl, payload.outputs.vocals) : undefined,
      instrumental: payload.outputs?.instrumental ? buildApiUrl(baseUrl, payload.outputs.instrumental) : undefined
    },
    createdAt: now,
    updatedAt: now
  };
}

function mapBackendStatus(status: BackendJobResponse["status"]): JobStatus {
  if (status === "processing") return "running";
  return status;
}
