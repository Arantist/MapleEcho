import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { NextResponse } from "next/server";
import { parseByteRange } from "@/lib/http-range";
import { getJob, resolveJobPaths } from "@/lib/jobs";
import type { StemName } from "@/lib/types";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string; stem: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const { id, stem } = await params;
  if (!isStemName(stem)) {
    return NextResponse.json({ error: "音轨不存在。" }, { status: 404 });
  }

  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }
  if (job.status === "failed") {
    return NextResponse.json({ error: job.error || "任务失败。" }, { status: 410 });
  }
  if (job.status !== "completed") {
    return NextResponse.json({ error: "任务尚未完成。" }, { status: 409 });
  }

  const filePath = fileForStem(id, stem);
  let fileSize = 0;
  try {
    fileSize = (await stat(filePath)).size;
  } catch {
    return NextResponse.json({ error: "结果文件不存在。" }, { status: 404 });
  }

  const filename = basename(filePath);
  const range = parseByteRange(request.headers.get("range"), fileSize);
  if (request.headers.has("range") && !range) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes */${fileSize}`
      }
    });
  }

  if (range) {
    const stream = createReadStream(filePath, { start: range.start, end: range.end });
    return new NextResponse(stream as unknown as BodyInit, {
      status: 206,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Type": "audio/mpeg",
        "Content-Length": String(range.contentLength),
        "Content-Range": `bytes ${range.start}-${range.end}/${fileSize}`,
        "Content-Disposition": `inline; filename="${filename}"`
      }
    });
  }

  const stream = createReadStream(filePath);
  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Type": "audio/mpeg",
      "Content-Length": String(fileSize),
      "Content-Disposition": `inline; filename="${filename}"`
    }
  });
}

function fileForStem(id: string, stem: StemName) {
  const paths = resolveJobPaths(id);
  if (stem === "vocals") return paths.vocalsFile;
  if (stem === "instrumental") return paths.instrumentalFile;
  if (stem === "guitar") return paths.guitarFile;
  return paths.noGuitarFile;
}

function isStemName(stem: string): stem is StemName {
  return stem === "vocals" || stem === "instrumental" || stem === "guitar" || stem === "no_guitar";
}
