import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

type FfprobeStatic = {
  path?: string;
};

const ffprobe = ffprobeStatic as FfprobeStatic;

export const FFMPEG_BIN = process.env.FFMPEG_BIN || ffmpegStatic || "ffmpeg";
export const FFPROBE_BIN = process.env.FFPROBE_BIN || ffprobe.path || "ffprobe";
