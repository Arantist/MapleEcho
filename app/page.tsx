"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Gauge,
  Loader2,
  Music2,
  Pause,
  Play,
  SlidersHorizontal,
  Upload
} from "lucide-react";
import {
  API_CONFIGURATION_ERROR,
  API_UNAVAILABLE_ERROR,
  createBackendJob,
  fetchBackendHealth,
  fetchBackendJob
} from "@/lib/api-client";
import { clampPlaybackTime, formatPlaybackTime, progressPercent } from "@/lib/player";
import type { BackendHealth, JobMode, JobRecord } from "@/lib/types";

export default function Home() {
  const [mode, setMode] = useState<JobMode>("speed");
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [system, setSystem] = useState<BackendHealth | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const hasApiBaseUrl = apiBaseUrl.trim().length > 0;

  const isBusy = uploading || job?.status === "queued" || job?.status === "running";
  const resultReady = job?.status === "completed";

  useEffect(() => {
    if (!hasApiBaseUrl) {
      setError(API_CONFIGURATION_ERROR);
      return;
    }
    fetchBackendHealth(apiBaseUrl)
      .then(setSystem)
      .catch(() => {
        setSystem(null);
        setError(API_UNAVAILABLE_ERROR);
      });
  }, [apiBaseUrl, hasApiBaseUrl]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const timer = window.setInterval(async () => {
      try {
        setJob(await fetchBackendJob(job.id, apiBaseUrl));
      } catch {
        setError(API_UNAVAILABLE_ERROR);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [apiBaseUrl, job]);

  const statusText = useMemo(() => {
    if (!job) return "等待上传";
    if (job.status === "queued") return "排队中";
    if (job.status === "running") return "分离中";
    if (job.status === "completed") return "已完成";
    return "处理失败";
  }, [job]);

  async function submit() {
    if (!file) {
      setError("请先选择一个音频文件。");
      return;
    }
    if (!hasApiBaseUrl) {
      setError(API_CONFIGURATION_ERROR);
      return;
    }
    setUploading(true);
    setError("");
    setJob(null);

    try {
      setJob(await createBackendJob({ file, mode, baseUrl: apiBaseUrl }));
    } catch (error) {
      setError(error instanceof Error ? error.message : API_UNAVAILABLE_ERROR);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f6f4] text-[#171717]">
      <header className="border-b border-[#deded8] bg-white/95 text-[#171717] shadow-[0_1px_0_rgba(255,255,255,0.9)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-[#d7d0be] bg-[#f8f7f3] text-[#2a2926] shadow-sm">
              <Music2 size={20} />
            </div>
            <div>
              <div className="text-base font-semibold tracking-[0.08em]">忆枫MapleEcho</div>
              <div className="text-xs text-[#73716c]">再也不用付费做伴奏啦～</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-sm text-[#5d5b56] sm:flex">
            <span>单文件</span>
            <span className="h-1 w-1 rounded-full bg-[#b9b6ad]" />
            <span>后端处理</span>
            <span className="h-1 w-1 rounded-full bg-[#b9b6ad]" />
            <span>Render 服务</span>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-7 lg:grid-cols-[minmax(420px,0.9fr)_minmax(620px,1.1fr)]">
        <div className="space-y-5">
          <div className="rounded-lg border border-[#deded8] bg-white p-5 shadow-[0_18px_50px_rgba(31,31,29,0.07)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8b806c]">Local Stem Studio</div>
                <h1 className="max-w-2xl text-2xl font-semibold leading-tight tracking-normal text-[#151515] sm:text-3xl">
                  上传音频，分离伴奏和人声
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66635d]">
                  选择一个音频文件，Render 后端调用 Demucs 生成 vocals 和 instrumental。
                </p>
              </div>
              <div className="hidden rounded border border-[#ddd6c6] bg-[#faf9f6] px-3 py-2 text-xs font-semibold text-[#6f6248] shadow-sm sm:block">
                100MB 内
              </div>
            </div>

            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,audio/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#bdbbb3] bg-[#f9f9f7] px-4 py-7 text-center transition hover:border-[#79766d] hover:bg-white"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#d8d5cc] bg-white text-[#292826] shadow-sm">
                <Upload size={24} />
              </span>
              <span className="max-w-full break-all text-base font-semibold text-[#1f1f1d]">{file ? file.name : "选择音频文件"}</span>
              <span className="text-sm text-[#77746d]">mp3、wav、flac、m4a、aac、ogg</span>
            </button>

            <div className="mt-5 grid gap-2 rounded-lg border border-[#deded8] bg-[#f4f4f1] p-1 sm:grid-cols-2">
              <ModeButton
                active={mode === "speed"}
                title="速度模式"
                body="后端使用 mdx_q 模型。"
                onClick={() => setMode("speed")}
              />
              <ModeButton
                active={mode === "quality"}
                title="质量模式"
                body="后端使用 htdemucs_ft 模型。"
                onClick={() => setMode("quality")}
              />
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={submit}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded bg-[#191918] px-4 font-semibold text-white shadow-[0_12px_24px_rgba(25,25,24,0.18)] transition hover:bg-[#30302d] disabled:cursor-not-allowed disabled:bg-[#e2e2dc] disabled:text-[#8a887f] disabled:shadow-none"
            >
              {isBusy ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
              开始分离
            </button>
            {error ? <Message tone="error" text={error} /> : null}
            {job?.warning ? <Message tone="warning" text={job.warning} /> : null}
            {job?.status === "failed" && job.error ? <Message tone="error" text={job.error} /> : null}
          </div>

          <div className="rounded-lg border border-[#deded8] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-[#1d1d1b]">
                <Gauge size={18} />
                任务状态
              </div>
              <span className="rounded border border-[#262622] bg-[#191918] px-3 py-1 text-xs font-semibold text-white">{statusText}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-[#e4e4df]">
              <div
                className="h-full rounded bg-[#81755d] transition-all"
                style={{ width: `${job?.progress ?? 0}%` }}
              />
            </div>
            <div className="mt-3 text-sm text-[#706d66]">
              {job ? job.message || `任务 ID：${job.id}` : "完成后会在这里显示试听和下载入口。"}
            </div>
          </div>
        </div>

        <div className="order-first space-y-4 lg:order-none">
          <div className="grid gap-4 sm:grid-cols-2">
            <ResultPanel
              title="Instrumental"
              subtitle="无人声伴奏"
              enabled={resultReady}
              src={resultReady ? job.files?.instrumental ?? "" : ""}
              downloadHref={resultReady ? job.files?.instrumental ?? "" : ""}
            />
            <ResultPanel
              title="Vocals"
              subtitle="人声"
              enabled={resultReady}
              src={resultReady ? job.files?.vocals ?? "" : ""}
              downloadHref={resultReady ? job.files?.vocals ?? "" : ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <PracticePanel />
            <SystemPanel system={system} />
          </div>
        </div>
      </section>
    </main>
  );
}

function ModeButton({ active, title, body, onClick }: { active: boolean; title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border p-4 text-left transition ${
        active
          ? "border-[#242421] bg-white text-[#171717] shadow-sm"
          : "border-transparent bg-transparent text-[#5f5d57] hover:border-[#d8d8d2] hover:bg-white/70"
      }`}
    >
      <div className="font-semibold">{title}</div>
      <div className={`mt-1 text-sm ${active ? "text-[#66635d]" : "text-[#85827a]"}`}>{body}</div>
    </button>
  );
}

function ResultPanel({
  title,
  subtitle,
  enabled,
  src,
  downloadHref
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  src: string;
  downloadHref: string;
}) {
  return (
    <div className="rounded-lg border border-[#deded8] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a857b]">{subtitle}</div>
          <div className="text-lg font-semibold text-[#171717]">{title}</div>
        </div>
        {enabled ? <CheckCircle2 className="text-[#81755d]" size={22} /> : <Pause className="text-[#aaa69d]" size={22} />}
      </div>
      <AudioPlayer enabled={enabled} src={src} label={title} />
      <a
        href={enabled ? downloadHref : undefined}
        download={enabled ? `${title.toLowerCase().replaceAll(" ", "_")}.mp3` : undefined}
        aria-disabled={!enabled}
        className={`mt-3 flex h-10 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold ${
          enabled
            ? "border-[#191918] bg-[#191918] text-white hover:bg-[#30302d]"
            : "pointer-events-none border-[#deded8] bg-[#f2f2ef] text-[#aaa69d]"
        }`}
      >
        <Download size={17} />
        下载 {title}
      </a>
    </div>
  );
}

function AudioPlayer({ enabled, src, label }: { enabled: boolean; src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    if (enabled && src) {
      audio.load();
      const timer = window.setTimeout(() => readAudioDuration(audio, setDuration), 200);
      return () => window.clearTimeout(timer);
    }
  }, [enabled, src]);

  const canControl = enabled && Boolean(src);
  const canSeek = canControl && duration > 0;
  const safeCurrentTime = clampPlaybackTime(currentTime, duration);
  const filled = progressPercent(safeCurrentTime, duration);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !canControl) return;
    if (audio.paused) {
      await audio.play();
      return;
    }
    audio.pause();
  }

  function seek(value: string) {
    const audio = audioRef.current;
    const nextTime = clampPlaybackTime(Number(value), duration);
    setCurrentTime(nextTime);
    if (audio && canSeek) {
      audio.currentTime = nextTime;
    }
  }

  return (
    <div className="rounded border border-[#e4e3de] bg-[#f7f7f5] px-3 py-3">
      <audio
        ref={audioRef}
        preload="metadata"
        src={canControl ? src : undefined}
        onLoadedMetadata={(event) => readAudioDuration(event.currentTarget, setDuration)}
        onDurationChange={(event) => readAudioDuration(event.currentTarget, setDuration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={(event) => {
          setPlaying(false);
          setCurrentTime(event.currentTarget.duration || 0);
        }}
      />
      <div className="grid grid-cols-[2rem_4.7rem_1fr] items-center gap-2">
        <button
          type="button"
          disabled={!canControl}
          onClick={togglePlayback}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#1d1d1b] transition hover:bg-[#e6e5df] disabled:text-[#b6b2a8] disabled:hover:bg-transparent"
          aria-label={`${playing ? "暂停" : "播放"} ${label}`}
        >
          {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </button>
        <div className="font-mono text-xs text-[#34332f] tabular-nums sm:text-sm">
          <div>{formatPlaybackTime(safeCurrentTime)}</div>
          <div className="text-[#8a877f]">{formatPlaybackTime(duration)}</div>
        </div>
        <input
          type="range"
          min="0"
          max={duration > 0 ? duration : 1}
          step="0.01"
          value={duration > 0 ? safeCurrentTime : 0}
          disabled={!canSeek}
          onChange={(event) => seek(event.target.value)}
          aria-label={`${label} 播放进度`}
          className="h-7 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, #191918 0%, #191918 ${filled}%, rgba(25, 25, 24, 0.16) ${filled}%, rgba(25, 25, 24, 0.16) 100%)`
          }}
        />
      </div>
    </div>
  );
}

function readAudioDuration(audio: HTMLAudioElement, setDuration: (duration: number) => void) {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    setDuration(audio.duration);
  }
}

function PracticePanel() {
  return (
    <div className="rounded-lg border border-[#deded8] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 font-semibold text-[#1d1d1b]">
        <SlidersHorizontal size={18} />
        练习模式
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["AB Loop", "变速", "变调"].map((label) => (
          <button
            key={label}
            type="button"
            disabled
            className="h-10 rounded border border-[#deded8] bg-[#f2f2ef] text-sm font-medium text-[#9a968c]"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SystemPanel({ system }: { system: BackendHealth | null }) {
  const service = system?.service ?? "";
  const entries = system
    ? [
        { key: "python", label: "python", ok: system.python },
        { key: "ffmpeg", label: "ffmpeg", ok: system.ffmpeg },
        { key: "ffprobe", label: "ffprobe", ok: system.ffprobe },
        { key: "demucs", label: "demucs", ok: system.demucs }
      ]
    : null;
  return (
    <div className="rounded-lg border border-[#deded8] bg-white p-5 shadow-sm">
      <div className="mb-3 font-semibold text-[#1d1d1b]">后端运行环境</div>
      <div className="space-y-2">
        {entries
          ? entries.map((item) => (
              <div key={item.key} className="flex items-start justify-between gap-3 border-t border-[#eeeeea] pt-2 text-sm first:border-t-0 first:pt-0">
                <span className="min-w-0">
                  <span className="block font-medium">{item.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-[#8e897f]" title={service}>
                    {service}
                  </span>
                </span>
                <span className={`shrink-0 ${item.ok ? "text-[#6f6248]" : "text-[#a33a42]"}`}>
                  {item.ok ? "可用" : "不可用"}
                </span>
              </div>
            ))
          : ["python", "ffmpeg", "ffprobe", "demucs"].map((item) => (
              <div key={item} className="flex items-center justify-between border-t border-[#eeeeea] pt-2 text-sm text-[#aaa69d] first:border-t-0 first:pt-0">
                <span>{item}</span>
                <span>检查中</span>
              </div>
            ))}
      </div>
    </div>
  );
}

function Message({ tone, text }: { tone: "error" | "warning"; text: string }) {
  const isError = tone === "error";
  return (
    <div
      className={`mt-4 flex items-start gap-2 rounded px-3 py-2 text-sm ${
        isError ? "bg-[#fff0f1] text-[#8b1f2c]" : "bg-[#f7f1df] text-[#6f5a1c]"
      }`}
    >
      <AlertCircle size={17} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
