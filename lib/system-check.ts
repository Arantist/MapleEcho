import { spawn } from "node:child_process";
import { DEFAULT_PYTHON } from "@/lib/paths";
import { FFMPEG_BIN, FFPROBE_BIN } from "@/lib/media-tools";

export type ParsedVersion = {
  raw: string;
  major: number;
  minor: number;
  patch: number;
};

export type SystemCheckResult = {
  python: ToolCheck;
  ffmpeg: ToolCheck;
  ffprobe: ToolCheck;
  demucs: ToolCheck;
  torch: ToolCheck;
  mps: ToolCheck;
};

type ToolCheck = {
  ok: boolean;
  label: string;
  detail: string;
  recommended?: boolean;
};

export function parseVersionLine(raw: string): ParsedVersion | null {
  const match = raw.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    raw: raw.trim(),
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

export function isRecommendedPythonVersion(version: ParsedVersion) {
  return version.major === 3 && (version.minor === 11 || version.minor === 12);
}

export async function checkSystem(pythonBin = DEFAULT_PYTHON): Promise<SystemCheckResult> {
  const [python, ffmpeg, ffprobe, demucs, torch, mps] = await Promise.all([
    checkPython(pythonBin),
    commandCheck(FFMPEG_BIN, ["-version"], "ffmpeg"),
    commandCheck(FFPROBE_BIN, ["-version"], "ffprobe"),
    pythonModuleCheck(pythonBin, "demucs"),
    pythonInlineCheck(pythonBin, "import torch; print(torch.__version__)"),
    pythonInlineCheck(pythonBin, "import torch; print(torch.backends.mps.is_available())")
  ]);

  return {
    python,
    ffmpeg,
    ffprobe,
    demucs: { ...demucs, label: "demucs" },
    torch: { ...torch, label: "torch" },
    mps: { ...mps, label: "MPS", ok: mps.ok && mps.detail.includes("True") }
  };
}

async function checkPython(pythonBin: string): Promise<ToolCheck> {
  const result = await commandCheck(pythonBin, ["--version"], "python");
  const parsed = parseVersionLine(result.detail);
  return {
    ...result,
    recommended: parsed ? isRecommendedPythonVersion(parsed) : false,
    detail: parsed && !isRecommendedPythonVersion(parsed)
      ? `${result.detail}；建议使用 Python 3.11，次选 3.12。`
      : result.detail
  };
}

async function pythonModuleCheck(pythonBin: string, moduleName: string): Promise<ToolCheck> {
  return commandCheck(pythonBin, ["-m", moduleName, "--help"], moduleName);
}

async function pythonInlineCheck(pythonBin: string, code: string): Promise<ToolCheck> {
  return commandCheck(pythonBin, ["-c", code], "python");
}

function commandCheck(command: string, args: string[], label: string): Promise<ToolCheck> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ ok: false, label, detail: error.message });
    });
    child.on("close", (code) => {
      const detail = (stdout || stderr || `exit ${code}`).split("\n")[0].trim();
      resolve({ ok: code === 0, label, detail });
    });
  });
}
