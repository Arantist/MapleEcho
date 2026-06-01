import type { JobMode } from "@/lib/types";

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["mp3", "wav", "flac", "m4a", "aac", "ogg"] as const;

type SupportedExtension = (typeof ALLOWED_EXTENSIONS)[number];

type ValidUpload = {
  ok: true;
  extension: SupportedExtension;
  mode: JobMode;
};

type InvalidUpload = {
  ok: false;
  status: 400;
  message: string;
};

export function validateUploadMetadata(input: {
  fileName: string;
  fileSize: number;
  mode: unknown;
}): ValidUpload | InvalidUpload {
  if (input.mode !== "speed" && input.mode !== "quality") {
    return {
      ok: false,
      status: 400,
      message: "处理模式只能是 speed 或 quality。"
    };
  }

  if (!input.fileName || input.fileSize <= 0) {
    return {
      ok: false,
      status: 400,
      message: "请选择一个有效的音频文件。"
    };
  }

  if (input.fileSize > MAX_UPLOAD_SIZE) {
    return {
      ok: false,
      status: 400,
      message: "文件不能超过 100MB。"
    };
  }

  const extension = input.fileName.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension as SupportedExtension)) {
    return {
      ok: false,
      status: 400,
      message: "仅支持 mp3、wav、flac、m4a、aac、ogg 音频文件。"
    };
  }

  return { ok: true, extension: extension as SupportedExtension, mode: input.mode };
}
