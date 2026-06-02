import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: "http://136.110.67.247/:path*"
      }
    ];
  }
};

export default nextConfig;
