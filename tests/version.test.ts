import { describe, expect, test } from "vitest";
import packageMetadata from "@/package.json";
import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/version";

describe("application version", () => {
  test("uses the package version for the visible version label", () => {
    expect(APP_VERSION).toBe(packageMetadata.version);
    expect(APP_VERSION_LABEL).toBe(`v${packageMetadata.version}`);
  });
});
