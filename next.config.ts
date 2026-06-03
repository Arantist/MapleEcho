import type { NextConfig } from "next";

const backendApiBaseUrl = process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

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
