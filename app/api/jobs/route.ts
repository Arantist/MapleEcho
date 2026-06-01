import { NextResponse } from "next/server";
import { hasAudioStream } from "@/lib/audio";
import { createJob, findActiveJob, resolveJobPaths, updateJob } from "@/lib/jobs";
import { startSeparationJob } from "@/lib/separation";
import { validateUploadMetadata } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const activeJob = await findActiveJob();
  if (activeJob) {
    return NextResponse.json(
      { error: "已有任务正在处理，请等待当前任务完成后再上传。" },
      { status: 429 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const mode = form.get("mode");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请上传一个音频文件。" }, { status: 400 });
  }

  const validation = validateUploadMetadata({
    fileName: file.name,
    fileSize: file.size,
    mode
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: validation.status });
  }

  const job = await createJob({
    fileName: file.name,
    extension: validation.extension,
    input: Buffer.from(await file.arrayBuffer()),
    mode: validation.mode
  });
  const paths = resolveJobPaths(job.id, undefined, validation.extension);
  const validAudio = await hasAudioStream(paths.inputFile);
  if (!validAudio) {
    await updateJob(job.id, {
      status: "failed",
      progress: 100,
      error: "文件中没有检测到音频流。"
    });
    return NextResponse.json({ error: "文件中没有检测到音频流。" }, { status: 400 });
  }

  startSeparationJob(job.id).catch(async (error) => {
    await updateJob(job.id, {
      status: "failed",
      progress: 100,
      error: error instanceof Error ? error.message : "启动分离任务失败。"
    });
  });

  return NextResponse.json({ id: job.id, status: "queued" });
}
