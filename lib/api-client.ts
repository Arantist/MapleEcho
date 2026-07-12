import type { BackendHealth, BackendJobMode, BackendJobResponse, JobMode, JobRecord, JobStatus, TargetStem } from "@/lib/types";

export const API_CONFIGURATION_ERROR = "请先配置 NEXT_PUBLIC_API_BASE_URL。";
export const API_UNAVAILABLE_ERROR = "后端服务不可用，请检查 Google Cloud 后端是否启动。";

export function getApiBaseUrl(value = process.env.NEXT_PUBLIC_API_BASE_URL) {
  return value?.trim() || "/api/backend";
}

export function requireApiBaseUrl(value = process.env.NEXT_PUBLIC_API_BASE_URL) {
  const trimmed = getApiBaseUrl(value);
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
  return mode;
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
  target: TargetStem;
  baseUrl?: string;
}): Promise<JobRecord> {
  const apiBaseUrl = requireApiBaseUrl(input.baseUrl);
  const form = new FormData();
  form.append("file", input.file);

  const params = new URLSearchParams({ mode: modeToBackendMode(input.mode), target: input.target });
  const response = await fetch(buildApiUrl(apiBaseUrl, `/api/jobs?${params.toString()}`), {
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
  mode: JobMode = "balanced"
): JobRecord {
  const now = new Date().toISOString();
  return {
    id: payload.jobId,
    originalName,
    extension: originalName.split(".").pop()?.toLowerCase() || "",
    mode: payload.mode ?? mode,
    status: mapBackendStatus(payload.status),
    progress: payload.progress ?? (payload.status === "completed" ? 100 : 0),
    message: payload.message,
    error: payload.status === "failed" ? payload.message : undefined,
    errorCode: payload.errorCode,
    target: payload.target,
    targetLabel: payload.targetLabel,
    format: payload.format,
    bitrate: payload.bitrate,
    files: {
      isolated: payload.isolated
        ? { label: payload.isolated.label, url: buildApiUrl(baseUrl, payload.isolated.url) }
        : payload.outputs?.guitar
          ? { label: "吉他轨道", url: buildApiUrl(baseUrl, payload.outputs.guitar) }
          : undefined,
      backing: payload.backing
        ? { label: payload.backing.label, url: buildApiUrl(baseUrl, payload.backing.url) }
        : payload.outputs?.no_guitar
          ? { label: "去吉他伴奏", url: buildApiUrl(baseUrl, payload.outputs.no_guitar) }
          : undefined,
      converted: payload.converted
        ? { label: payload.converted.label, url: buildApiUrl(baseUrl, payload.converted.url) }
        : undefined
    },
    createdAt: now,
    updatedAt: now
  };
}

function mapBackendStatus(status: BackendJobResponse["status"]): JobStatus {
  if (status === "processing") return "running";
  return status;
}
