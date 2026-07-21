import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = fileURLToPath(import.meta.resolve("@soundtouchjs/audio-worklet/processor"));
const destination = resolve(projectRoot, "public", "soundtouch-processor.js");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
