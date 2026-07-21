import type { NextConfig } from "next";

const DEFAULT_BACKEND_API_BASE_URL = "http://34.136.34.53:8000";

export function resolveBackendApiBaseUrl(
  value = process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL,
  vercelEnv = process.env.VERCEL_ENV
) {
  const candidate = value?.trim();
  if (!candidate) return DEFAULT_BACKEND_API_BASE_URL;

  if (!isHttpUrl(candidate)) {
    return DEFAULT_BACKEND_API_BASE_URL;
  }

  if (vercelEnv === "production" && resolvesToPrivateHost(candidate)) {
    return DEFAULT_BACKEND_API_BASE_URL;
  }

  return candidate;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function resolvesToPrivateHost(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    const octets = host.split(".").map(Number);

    return (
      host === "localhost" ||
      host.endsWith(".local") ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.startsWith("127.") ||
      host.startsWith("169.254.") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    );
  } catch {
    return false;
  }
}

const backendApiBaseUrl = resolveBackendApiBaseUrl();

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendApiBaseUrl.replace(/\/+$/, "")}/:path*`
      }
    ];
  }
};

export default nextConfig;
