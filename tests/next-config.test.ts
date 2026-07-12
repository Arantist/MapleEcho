import { describe, expect, test } from "vitest";

import nextConfig, { resolveBackendApiBaseUrl } from "../next.config";

describe("next config backend rewrite", () => {
  test("defaults the backend rewrite to the active Google Cloud backend", async () => {
    const rewrites = await nextConfig.rewrites?.();

    expect(rewrites).toContainEqual({
      source: "/api/backend/:path*",
      destination: "http://34.136.34.53:8000/:path*"
    });
  });

  test("keeps localhost backend URLs available outside production", () => {
    expect(resolveBackendApiBaseUrl("http://localhost:8000", "development")).toBe("http://localhost:8000");
  });

  test("falls back to the active Google Cloud backend for private production targets", () => {
    expect(resolveBackendApiBaseUrl("http://localhost:8000", "production")).toBe("http://34.136.34.53:8000");
    expect(resolveBackendApiBaseUrl("http://127.0.0.1:8000", "production")).toBe("http://34.136.34.53:8000");
    expect(resolveBackendApiBaseUrl("http://192.168.1.20:8000", "production")).toBe("http://34.136.34.53:8000");
  });
});
