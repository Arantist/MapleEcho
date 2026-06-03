"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileAudio,
  Loader2,
  Music2,
  Pause,
  Play,
  SlidersHorizontal,
  Sparkles,
  Upload
} from "lucide-react";
import {
  API_CONFIGURATION_ERROR,
  API_UNAVAILABLE_ERROR,
  createBackendJob,
  fetchBackendJob,
  getApiBaseUrl
} from "@/lib/api-client";
import { clampPlaybackTime, formatPlaybackTime, progressPercent } from "@/lib/player";
import type { JobMode, JobRecord, TargetStem } from "@/lib/types";

type UiMode = "standard" | "quality";

type TargetOption = {
  value: TargetStem;
  label: string;
  output: string;
};

type ModeOption = {
  value: UiMode;
  label: string;
  description: string;
  badge?: string;
};

type ResultState = {
  isolatedUrl: string;
  backingUrl: string;
  isolatedLabel: string;
  backingLabel: string;
  targetLabel: string;
};

const TARGET_OPTIONS: TargetOption[] = [
  { value: "guitar", label: "电吉他 / 原声吉他", output: "输出 guitar 和 no_guitar" },
  { value: "bass", label: "贝斯", output: "输出 bass 和 no_bass" },
  { value: "drums", label: "鼓点", output: "输出 drums 和 no_drums" },
  { value: "vocals", label: "人声", output: "输出 vocals 和 no_vocals" }
];

const MODE_OPTIONS: ModeOption[] = [
  { value: "standard", label: "标准模式", description: "MP3 256kbps，速度和质量平衡" },
  { value: "quality", label: "质量模式", description: "MP3 320kbps，双次 shift 平均，分离度更好", badge: "推荐质量" }
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<TargetStem>("guitar");
  const [selectedMode, setSelectedMode] = useState<UiMode>("standard");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("等待上传");
  const [result, setResult] = useState<ResultState | null>(null);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [error, setError] = useState("");
  const [practiceNotice, setPracticeNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const apiBaseUrl = getApiBaseUrl();
  const hasApiBaseUrl = apiBaseUrl.trim().length > 0;

  const selectedTargetLabel = useMemo(
    () => TARGET_OPTIONS.find((option) => option.value === selectedTarget)?.label ?? "目标轨道",
    [selectedTarget]
  );
  const showResultDetail = Boolean(job || result || isProcessing);
  const canSubmit = Boolean(selectedFile) && !isProcessing;
  const progress = job?.progress ?? (isProcessing ? 8 : 0);

  const applyJobUpdate = useCallback((nextJob: JobRecord) => {
    setJob(nextJob);

    if (nextJob.status === "queued") {
      setIsProcessing(true);
      setStatusText("后端处理中");
      return;
    }

    if (nextJob.status === "running") {
      setIsProcessing(true);
      setStatusText(nextJob.message || "后端处理中");
      return;
    }

    if (nextJob.status === "completed") {
      setIsProcessing(false);
      setStatusText("分离完成");
      setResult(buildResultState(nextJob, selectedTargetLabel));
      return;
    }

    setIsProcessing(false);
    setStatusText("出错");
  }, [selectedTargetLabel]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;

    const timer = window.setInterval(async () => {
      try {
        const nextJob = await fetchBackendJob(job.id, apiBaseUrl);
        applyJobUpdate(nextJob);
      } catch {
        setIsProcessing(false);
        setError(API_UNAVAILABLE_ERROR);
        setStatusText("出错");
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [apiBaseUrl, applyJobUpdate, job]);

  function handleFileChange(nextFile: File | null) {
    setSelectedFile(nextFile);
    setError("");
    setResult(null);
    setJob(null);
    setStatusText(nextFile ? "已选择文件" : "等待上传");
  }

  async function submit() {
    if (!selectedFile) {
      setError("请先选择一个音频文件。");
      setStatusText("等待上传");
      return;
    }

    if (!hasApiBaseUrl) {
      setError(API_CONFIGURATION_ERROR);
      setStatusText("出错");
      return;
    }

    setIsProcessing(true);
    setStatusText("正在上传");
    setError("");
    setResult(null);
    setJob(null);

    try {
      const backendMode = uiModeToJobMode(selectedMode);
      const createdJob = await createBackendJob({
        file: selectedFile,
        mode: backendMode,
        target: selectedTarget,
        baseUrl: apiBaseUrl
      });
      applyJobUpdate(createdJob);
    } catch (caughtError) {
      setIsProcessing(false);
      setStatusText("出错");
      setError(caughtError instanceof Error ? caughtError.message : API_UNAVAILABLE_ERROR);
    }
  }

  function handlePracticeClick(label: string) {
    setPracticeNotice(`${label} 功能开发中`);
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f7f6f2_0%,#efeee8_48%,#f8f8f6_100%)] text-[#171717]">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#dedbd2]/80 bg-white/78 shadow-[0_8px_30px_rgba(42,39,32,0.06)] backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1280px] items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#d7d0be] bg-[#fbfaf7] text-[#24231f] shadow-sm">
              <Music2 size={21} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-[#20201d]">忆枫 MapleEcho</div>
              <div className="truncate text-xs text-[#77736a]">再也不用付费做伴奏啦～</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-sm text-[#666259] sm:flex">
            <span>单文件</span>
            <span className="h-1 w-1 rounded-full bg-[#bbb7ac]" />
            <span>后端处理</span>
            <span className="h-1 w-1 rounded-full bg-[#bbb7ac]" />
            <span>Google Cloud</span>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-5 px-4 pb-10 pt-24 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(390px,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5 sm:p-7">
            <div className="mb-6">
              <SectionLabel>UPLOAD / 上传音频</SectionLabel>
              <h1 className="mt-3 max-w-full break-all text-2xl font-semibold leading-tight text-[#151515] sm:text-3xl">
                上传音频，分离目标轨道和练习伴奏
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#69655d] sm:text-base">
                选择目标轨道，Google Cloud 后端只返回目标轨道和去目标伴奏，默认使用 MP3。
              </p>
            </div>

            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,audio/*"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="group flex min-h-40 w-full min-w-0 flex-col justify-between rounded-2xl border border-dashed border-[#beb9ad] bg-[#faf9f5] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#24231f] hover:bg-white hover:shadow-[0_16px_38px_rgba(42,39,32,0.08)] sm:flex-row sm:items-center sm:gap-5"
            >
              <span className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#d8d4c9] bg-white text-[#25241f] shadow-sm transition group-hover:border-[#24231f]">
                  {selectedFile ? <FileAudio size={24} /> : <Upload size={24} />}
                </span>
                <span className="min-w-0">
                  <span className="block max-w-full break-all text-lg font-semibold text-[#20201d]">
                    {selectedFile ? selectedFile.name : "选择音频文件"}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[#77736b]">
                    mp3、wav、flac、m4a、aac、ogg
                  </span>
                  {selectedFile ? (
                    <span className="mt-2 block text-sm text-[#5d594f]">
                      {formatFileSize(selectedFile.size)} · 已选择文件
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="mt-5 inline-flex w-fit rounded-xl border border-[#ddd6c6] bg-white px-4 py-2 text-sm font-semibold text-[#6f6248] shadow-sm sm:mt-0">
                100MB 内
              </span>
            </button>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-4">
              <SectionLabel>TARGET / 选择目标轨道</SectionLabel>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {TARGET_OPTIONS.map((option) => (
                <TargetButton
                  key={option.value}
                  active={selectedTarget === option.value}
                  option={option}
                  onClick={() => setSelectedTarget(option.value)}
                />
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-4">
              <SectionLabel>MODE / 处理模式</SectionLabel>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODE_OPTIONS.map((option) => (
                <ModeButton
                  key={option.value}
                  active={selectedMode === option.value}
                  option={option}
                  onClick={() => setSelectedMode(option.value)}
                />
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#191918] px-5 text-base font-semibold text-white shadow-[0_18px_35px_rgba(25,25,24,0.18)] transition hover:-translate-y-0.5 hover:bg-[#2d2c29] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#deddd6] disabled:text-[#9b978e] disabled:shadow-none"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={19} /> : <Play size={19} fill="currentColor" />}
              {isProcessing ? "正在分离..." : "开始分离"}
            </button>
            <StatusBar statusText={statusText} progress={progress} isProcessing={isProcessing} />
            {error ? <Message tone="error" text={error} /> : null}
            {job?.warning ? <Message tone="warning" text={job.warning} /> : null}
            {job?.status === "failed" && job.error ? <Message tone="error" text={job.error} /> : null}
          </Card>
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-24">
          <Card className="overflow-hidden p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <SectionLabel>RESULT / 分离结果</SectionLabel>
                <h2 className="mt-3 text-2xl font-semibold text-[#181817]">分离结果</h2>
              </div>
              {result ? <CheckCircle2 className="mt-1 text-[#6f6248]" size={24} /> : <Sparkles className="mt-1 text-[#aaa398]" size={24} />}
            </div>

            {!showResultDetail ? (
              <div className="rounded-2xl border border-dashed border-[#d7d3c8] bg-[#f8f7f3] px-5 py-12 text-center text-sm leading-7 text-[#77736a]">
                上传音频并开始分离后，目标轨道和练习伴奏会显示在这里。
              </div>
            ) : (
              <div className="overflow-hidden transition-all duration-500 ease-out">
                <div className="animate-[resultReveal_420ms_ease-out] space-y-4">
                  {result ? (
                    <>
                      <ResultPanel
                        title={`目标轨道：${result.targetLabel}`}
                        subtitle={result.isolatedLabel}
                        src={result.isolatedUrl}
                        downloadHref={result.isolatedUrl}
                        downloadLabel="下载目标轨道"
                      />
                      <ResultPanel
                        title="去目标伴奏"
                        subtitle={result.backingLabel}
                        src={result.backingUrl}
                        downloadHref={result.backingUrl}
                        downloadLabel="下载去目标伴奏"
                      />
                    </>
                  ) : (
                    <div className="rounded-2xl border border-[#e5e1d7] bg-[#faf9f5] px-5 py-10 text-center">
                      <Loader2 className="mx-auto mb-3 animate-spin text-[#6f6248]" size={24} />
                      <div className="font-semibold text-[#24231f]">正在生成结果</div>
                      <div className="mt-2 text-sm leading-6 text-[#77736b]">
                        后端处理完成后，目标轨道和去目标伴奏会在这里展开。
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-[#5e594f]" />
              <div>
                <SectionLabel>PRACTICE / 练习模式</SectionLabel>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["AB Loop", "变速", "变调"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handlePracticeClick(label)}
                  className="h-11 rounded-xl border border-[#d9d5cb] bg-[#faf9f5] text-sm font-semibold text-[#5d594f] transition hover:-translate-y-0.5 hover:border-[#24231f] hover:bg-white"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 min-h-6 text-sm text-[#77736b]">{practiceNotice}</div>
          </Card>
        </aside>
      </section>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-3 right-3 z-50 rounded border border-[#d8d3c7] bg-white/78 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#756d5f] shadow-sm backdrop-blur"
      >
        From Arain
      </div>
      <style jsx global>{`
        @keyframes resultReveal {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={`w-full min-w-0 rounded-2xl border border-[#dedbd2] bg-white/88 shadow-[0_18px_50px_rgba(42,39,32,0.07)] backdrop-blur ${className}`}>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8a806e]">{children}</div>;
}

function TargetButton({ active, option, onClick }: { active: boolean; option: TargetOption; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-28 min-w-0 rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 ${
        active
          ? "border-[#22211e] bg-[#fffdf7] shadow-[0_12px_26px_rgba(42,39,32,0.10)]"
          : "border-[#e3dfd5] bg-[#faf9f5] hover:border-[#8f8779] hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-base font-semibold text-[#20201d]">{option.label}</div>
        <span
          className={`mt-1 h-3 w-3 shrink-0 rounded-full border ${
            active ? "border-[#22211e] bg-[#22211e]" : "border-[#bcb6aa] bg-white"
          }`}
        />
      </div>
      <div className="mt-3 text-sm leading-6 text-[#77736b]">{option.output}</div>
    </button>
  );
}

function ModeButton({ active, option, onClick }: { active: boolean; option: ModeOption; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-28 min-w-0 rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 ${
        active
          ? "border-[#22211e] bg-[#fffdf7] shadow-[0_12px_26px_rgba(42,39,32,0.10)]"
          : "border-[#e3dfd5] bg-[#faf9f5] hover:border-[#8f8779] hover:bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-base font-semibold text-[#20201d]">{option.label}</div>
        {option.badge ? (
          <span className="rounded-full bg-[#efe7d5] px-2 py-0.5 text-xs font-semibold text-[#6f6248]">{option.badge}</span>
        ) : null}
      </div>
      <div className="mt-3 text-sm leading-6 text-[#77736b]">{option.description}</div>
    </button>
  );
}

function StatusBar({ statusText, progress, isProcessing }: { statusText: string; progress: number; isProcessing: boolean }) {
  return (
    <div className="mt-4 rounded-2xl border border-[#e2ded4] bg-[#faf9f5] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-semibold text-[#2b2a26]">{statusText}</div>
        <div className="text-xs font-medium text-[#77736b]">{Math.round(progress)}%</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5e1d8]">
        <div
          className={`h-full rounded-full bg-[#6f6248] transition-all duration-500 ${isProcessing ? "animate-pulse" : ""}`}
          style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
        />
      </div>
    </div>
  );
}

function ResultPanel({
  title,
  subtitle,
  src,
  downloadHref,
  downloadLabel
}: {
  title: string;
  subtitle: string;
  src: string;
  downloadHref: string;
  downloadLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e1ddd3] bg-[#fbfaf7] p-4 shadow-sm">
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8a806e]">{subtitle}</div>
        <div className="mt-2 text-lg font-semibold text-[#181817]">{title}</div>
      </div>
      <AudioPlayer src={src} label={title} />
      <a
        href={downloadHref}
        download={`${subtitle.toLowerCase().replaceAll(" ", "_")}.mp3`}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#191918] bg-[#191918] px-4 text-sm font-semibold text-white transition hover:bg-[#30302d]"
      >
        <Download size={17} />
        {downloadLabel}
      </a>
    </div>
  );
}

function AudioPlayer({ src, label }: { src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const resetTimer = window.setTimeout(() => {
      setCurrentTime(0);
      setDuration(0);
      setPlaying(false);
      audio.pause();
      audio.currentTime = 0;
      audio.load();
    }, 0);
    const durationTimer = window.setTimeout(() => readAudioDuration(audio, setDuration), 200);
    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(durationTimer);
    };
  }, [src]);

  const canSeek = duration > 0;
  const safeCurrentTime = clampPlaybackTime(currentTime, duration);
  const filled = progressPercent(safeCurrentTime, duration);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
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
    <div className="rounded-xl border border-[#e4e0d7] bg-white px-4 py-4">
      <audio
        ref={audioRef}
        preload="metadata"
        src={src}
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
      <div className="grid grid-cols-[2rem_4.4rem_minmax(0,1fr)] items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#1d1d1b] transition hover:bg-[#e8e5dd]"
          aria-label={`${playing ? "暂停" : "播放"} ${label}`}
        >
          {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </button>
        <div className="font-mono text-sm text-[#34332f] tabular-nums">
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

function Message({ tone, text }: { tone: "error" | "warning"; text: string }) {
  const isError = tone === "error";
  return (
    <div
      className={`mt-4 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${
        isError ? "bg-[#fff0f1] text-[#8b1f2c]" : "bg-[#f7f1df] text-[#6f5a1c]"
      }`}
    >
      <AlertCircle size={17} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function uiModeToJobMode(mode: UiMode): JobMode {
  return mode === "standard" ? "balanced" : "quality";
}

function buildResultState(job: JobRecord, fallbackTargetLabel: string): ResultState | null {
  const isolated = job.files?.isolated;
  const backing = job.files?.backing;
  if (!isolated || !backing) return null;

  return {
    isolatedUrl: isolated.url,
    backingUrl: backing.url,
    isolatedLabel: isolated.label,
    backingLabel: backing.label,
    targetLabel: job.targetLabel || fallbackTargetLabel
  };
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function readAudioDuration(audio: HTMLAudioElement, setDuration: (duration: number) => void) {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    setDuration(audio.duration);
  }
}
