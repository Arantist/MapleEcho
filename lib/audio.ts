import { spawn } from "node:child_process";
import { FFPROBE_BIN } from "@/lib/media-tools";

export async function hasAudioStream(filePath: string): Promise<boolean> {
  const args = [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=codec_type",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath
  ];

  return new Promise((resolve) => {
    const child = spawn(FFPROBE_BIN, args, { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0 && output.includes("audio")));
  });
}
