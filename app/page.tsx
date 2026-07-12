"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileAudio,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X
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

type UiMode = "standard" | "quality" | "convert";

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
  isolatedUrl?: string;
  backingUrl?: string;
  isolatedLabel?: string;
  backingLabel?: string;
  targetLabel?: string;
  convertedUrl?: string;
  convertedLabel?: string;
  convertedDownloadName?: string;
};

const TARGET_OPTIONS: TargetOption[] = [
  { value: "guitar", label: "电吉他 / 原声吉他", output: "输出 guitar 和 no_guitar" },
  { value: "bass", label: "贝斯", output: "输出 bass 和 no_bass" },
  { value: "drums", label: "鼓点", output: "输出 drums 和 no_drums" },
  { value: "vocals", label: "人声", output: "输出 vocals 和 no_vocals" }
];

const MODE_OPTIONS: ModeOption[] = [
  { value: "standard", label: "标准模式", description: "MP3 256kbps，速度和质量平衡" },
  { value: "quality", label: "质量模式", description: "MP3 320kbps，双次 shift 平均，分离度更好", badge: "推荐质量" },
  { value: "convert", label: "转为 MP3", description: "NCM 文件转换为标准 MP3" }
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<TargetStem>("guitar");
  const [selectedMode, setSelectedMode] = useState<UiMode>("standard");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [statusText, setStatusText] = useState("等待上传");
  const [result, setResult] = useState<ResultState | null>(null);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const apiBaseUrl = getApiBaseUrl();
  const hasApiBaseUrl = apiBaseUrl.trim().length > 0;
  const isConvertMode = selectedMode === "convert";
  const isNcmFile = selectedFile?.name.toLowerCase().endsWith(".ncm") ?? false;

  const selectedTargetLabel = useMemo(
    () => TARGET_OPTIONS.find((option) => option.value === selectedTarget)?.label ?? "目标轨道",
    [selectedTarget]
  );
  const showResultDetail = Boolean(job || result || isProcessing);
  const canSubmit = Boolean(selectedFile) && !isProcessing && (!isConvertMode || isNcmFile);
  const progress = job?.progress ?? (isProcessing ? 8 : 0);

  const applyJobUpdate = useCallback(
    (nextJob: JobRecord) => {
      setJob(nextJob);

      if (nextJob.status === "queued") {
        setIsProcessing(true);
        setStatusText("任务已提交，等待后端处理");
        return;
      }

      if (nextJob.status === "running") {
        setIsProcessing(true);
        setStatusText(nextJob.message || "后端处理中");
        return;
      }

      if (nextJob.status === "completed") {
        setIsProcessing(false);
        setStatusText(nextJob.mode === "convert" ? "转换完成" : "分离完成");
        setResult(buildResultState(nextJob, selectedTargetLabel));
        return;
      }

      setIsProcessing(false);
      setStatusText("处理失败");
    },
    [selectedTargetLabel]
  );

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;

    const timer = window.setInterval(async () => {
      try {
        const nextJob = await fetchBackendJob(job.id, apiBaseUrl);
        applyJobUpdate(nextJob);
      } catch {
        setIsProcessing(false);
        setError(API_UNAVAILABLE_ERROR);
        setStatusText("连接异常");
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [apiBaseUrl, applyJobUpdate, job]);

  function handleFileChange(nextFile: File | null) {
    setSelectedFile(nextFile);
    setResult(null);
    setJob(null);
    setStatusText(nextFile ? "已选择文件" : "等待上传");
    setError("");

    if (nextFile && selectedMode === "convert" && !nextFile.name.toLowerCase().endsWith(".ncm")) {
      setSelectedMode("standard");
      setError("转为 MP3 模式仅支持 NCM 文件，已切换为标准模式。");
    }
  }

  function handleModeChange(nextMode: UiMode) {
    if (nextMode === "convert" && selectedFile && !isNcmFile) {
      setError("转为 MP3 模式仅支持 NCM 文件，请选择 NCM 文件后重试。");
      return;
    }
    setSelectedMode(nextMode);
    setError("");
    setResult(null);
    setJob(null);
    setStatusText(selectedFile ? "已选择文件" : "等待上传");
  }

  function clearFile() {
    if (isProcessing) return;
    handleFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit() {
    if (!selectedFile) {
      setError("请先选择一个音频文件。");
      setStatusText("等待上传");
      return;
    }

    if (isConvertMode && !isNcmFile) {
      setError("转为 MP3 模式仅支持 NCM 文件，请重新选择文件。");
      return;
    }

    if (!hasApiBaseUrl) {
      setError(API_CONFIGURATION_ERROR);
      setStatusText("连接异常");
      return;
    }

    setIsProcessing(true);
    setStatusText("正在上传音频");
    setError("");
    setResult(null);
    setJob(null);

    try {
      const createdJob = await createBackendJob({
        file: selectedFile,
        mode: uiModeToJobMode(selectedMode),
        target: selectedTarget,
        baseUrl: apiBaseUrl
      });
      applyJobUpdate(createdJob);
    } catch (caughtError) {
      setIsProcessing(false);
      setStatusText("处理失败");
      setError(toUserError(caughtError));
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f3ed] text-[#1d1c19]">
      <AppHeader />

      <div className="workbench mx-auto grid w-full max-w-[1280px] gap-5 px-4 py-6 sm:px-6">
        <div className="workbench-column workbench-left">
          <div className="workbench-upload min-w-0">
            <UploadCard
              file={selectedFile}
              inputRef={inputRef}
              isDragging={isDragging}
              disabled={isProcessing}
              onFileChange={handleFileChange}
              onClear={clearFile}
              onDraggingChange={setIsDragging}
            />
          </div>

          <div className="workbench-target min-w-0">
            <TargetSelector
              selectedTarget={selectedTarget}
              disabled={isConvertMode}
              onChange={setSelectedTarget}
            />
          </div>

          <div className="workbench-practice min-w-0">
            <PracticePanel />
          </div>
        </div>

        <div className="workbench-column workbench-right">
          <div className="workbench-result min-w-0">
            <ResultsCard
              isConvertMode={isConvertMode}
              isProcessing={isProcessing}
              showDetail={showResultDetail}
              result={result}
              statusText={statusText}
              progress={progress}
            />
          </div>

          <div className="workbench-mode min-w-0">
            <ModeSelector selectedMode={selectedMode} onChange={handleModeChange} />
          </div>

          <div className="workbench-action min-w-0">
            <ActionPanel
              canSubmit={canSubmit}
              isProcessing={isProcessing}
              isConvertMode={isConvertMode}
              statusText={statusText}
              progress={progress}
              error={error || (job?.status === "failed" ? job.error || "处理失败，请重新尝试。" : "")}
              warning={job?.warning}
              onSubmit={submit}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function AppHeader() {
  return (
    <header className="border-b border-[#e4e0d7] bg-[#fffefc]">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#ded8ca] bg-[#f8f5ed] text-[#26241f]">
            <Music2 size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-[#24221e]">忆枫 MapleEcho</div>
            <div className="truncate text-xs text-[#7d776d]">再也不用付费做伴奏啦～</div>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 text-sm text-[#716c63] md:flex">
          <span>单文件</span><Dot /><span>后端处理</span><Dot /><span>Google Cloud</span>
        </div>
      </div>
    </header>
  );
}

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-[#b8b1a5]" aria-hidden="true" />;
}

function UploadCard({
  file,
  inputRef,
  isDragging,
  disabled,
  onFileChange,
  onClear,
  onDraggingChange
}: {
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  disabled: boolean;
  onFileChange: (file: File | null) => void;
  onClear: () => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  function acceptDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    onDraggingChange(false);
    if (!disabled) onFileChange(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <Card>
      <SectionLabel>UPLOAD / 上传音频</SectionLabel>
      <h1 className="mt-3 text-[26px] font-semibold leading-[1.25] text-[#1d1c19] sm:text-[30px]">
        上传音频，分离目标轨道和练习伴奏
      </h1>
      <p className="mt-3 text-sm leading-7 text-[#716c63]">
        选择目标轨道，Google Cloud 后端只返回目标轨道和去目标伴奏，默认使用 MP3。
      </p>

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,.ncm,audio/*"
        disabled={disabled}
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!disabled && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => { event.preventDefault(); if (!disabled) onDraggingChange(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDraggingChange(false);
        }}
        onDrop={acceptDrop}
        className={`mt-6 flex min-h-[140px] min-w-0 cursor-pointer items-center gap-4 rounded-[14px] border border-dashed p-5 transition-colors sm:gap-5 ${
          isDragging ? "border-[#282621] bg-[#f4f0e6]" : "border-[#c9c2b6] bg-[#faf8f3] hover:border-[#7d7569]"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#ded8cc] bg-white text-[#2a2823]">
          {file ? <FileAudio size={24} aria-hidden="true" /> : <Upload size={23} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block overflow-hidden break-all text-base font-semibold leading-6 text-[#24221e] sm:text-lg">
            {file ? file.name : "点击选择或拖拽音频文件"}
          </span>
          <span className="mt-1 block text-xs leading-5 text-[#817b71] sm:text-sm">
            mp3、wav、flac、m4a、aac、ogg、ncm
          </span>
          <span className="mt-2 block text-xs font-medium text-[#625d54] sm:text-sm">
            {file ? `${formatFileSize(file.size)} · 已选择文件` : "支持单个音频文件"}
          </span>
        </span>
        <span className="hidden shrink-0 rounded-[10px] border border-[#e0dacd] bg-white px-3 py-2 text-xs font-semibold text-[#706454] sm:inline-flex">
          100MB 内
        </span>
        {file && !disabled ? (
          <button
            type="button"
            aria-label="移除已选择文件"
            title="移除文件"
            onClick={(event) => { event.stopPropagation(); onClear(); }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#716c63] hover:bg-[#ede8de] hover:text-[#25231f]"
          >
            <X size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </Card>
  );
}

function TargetSelector({
  selectedTarget,
  disabled,
  onChange
}: {
  selectedTarget: TargetStem;
  disabled: boolean;
  onChange: (target: TargetStem) => void;
}) {
  return (
    <Card className={disabled ? "opacity-60" : ""}>
      <SectionLabel>TARGET / 选择目标轨道</SectionLabel>
      <fieldset disabled={disabled} role="radiogroup" className="mt-4 grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">选择目标轨道</legend>
        {TARGET_OPTIONS.map((option) => (
          <ChoiceButton
            key={option.value}
            active={selectedTarget === option.value}
            label={option.label}
            description={option.output}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          />
        ))}
      </fieldset>
      {disabled ? <p className="mt-4 text-sm text-[#746c60]">转为 MP3 模式无需选择目标轨道。</p> : null}
    </Card>
  );
}

function ModeSelector({ selectedMode, onChange }: { selectedMode: UiMode; onChange: (mode: UiMode) => void }) {
  return (
    <Card>
      <SectionLabel>MODE / 处理模式</SectionLabel>
      <div role="radiogroup" aria-label="处理模式" className="mt-4 grid gap-3 sm:grid-cols-2">
        {MODE_OPTIONS.map((option) => (
          <ChoiceButton
            key={option.value}
            active={selectedMode === option.value}
            label={option.label}
            description={option.description}
            badge={option.badge}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
    </Card>
  );
}

function ResultsCard({
  isConvertMode,
  isProcessing,
  showDetail,
  result,
  statusText,
  progress
}: {
  isConvertMode: boolean;
  isProcessing: boolean;
  showDetail: boolean;
  result: ResultState | null;
  statusText: string;
  progress: number;
}) {
  return (
    <Card className="min-h-[350px] overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionLabel>RESULT / {isConvertMode ? "转换结果" : "分离结果"}</SectionLabel>
          <h2 className="mt-3 text-[24px] font-semibold text-[#1d1c19]">{isConvertMode ? "转换结果" : "分离结果"}</h2>
        </div>
        {result ? <CheckCircle2 className="text-[#625a4e]" size={22} /> : <Sparkles className="text-[#aaa398]" size={22} />}
      </div>

      <div className="mt-5 min-h-[230px]">
        {!showDetail ? (
          <div className="flex min-h-[230px] items-center justify-center rounded-[14px] border border-dashed border-[#d6d0c4] bg-[#faf8f3] px-6 text-center text-sm leading-7 text-[#7a746b]">
            上传音频并开始分离后，目标轨道和练习伴奏会显示在这里。
          </div>
        ) : result ? (
          <div className="space-y-4">
            {result.convertedUrl ? (
              <ResultPanel
                title="转换后的 MP3"
                subtitle={result.convertedLabel || "MP3 文件"}
                src={result.convertedUrl}
                downloadHref={result.convertedUrl}
                downloadLabel="下载 MP3"
                downloadName={result.convertedDownloadName}
              />
            ) : result.isolatedUrl && result.backingUrl && result.isolatedLabel && result.backingLabel ? (
              <>
                <ResultPanel title={result.targetLabel || "目标轨道"} subtitle={result.isolatedLabel} src={result.isolatedUrl} downloadHref={result.isolatedUrl} downloadLabel="下载目标轨道" />
                <ResultPanel title={`No ${result.targetLabel || "目标轨道"}`} subtitle={result.backingLabel} src={result.backingUrl} downloadHref={result.backingUrl} downloadLabel="下载练习伴奏" />
              </>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-[230px] flex-col items-center justify-center rounded-[14px] border border-[#e3ded4] bg-[#faf8f3] px-5 text-center">
            <LoaderCircle className="mb-4 animate-spin text-[#716657]" size={24} aria-hidden="true" />
            <div className="font-semibold text-[#292722]">{statusText}</div>
            <div className="mt-2 text-sm text-[#7a746b]">当前进度 {Math.round(progress)}%</div>
            {isProcessing ? <div className="mt-5 h-1.5 w-full max-w-64 overflow-hidden rounded-full bg-[#e6e0d6]"><div className="h-full rounded-full bg-[#6c6255] transition-all duration-500" style={{ width: `${clampProgress(progress)}%` }} /></div> : null}
          </div>
        )}
      </div>
    </Card>
  );
}

function ActionPanel({
  canSubmit,
  isProcessing,
  isConvertMode,
  statusText,
  progress,
  error,
  warning,
  onSubmit
}: {
  canSubmit: boolean;
  isProcessing: boolean;
  isConvertMode: boolean;
  statusText: string;
  progress: number;
  error?: string;
  warning?: string;
  onSubmit: () => void;
}) {
  return (
    <Card>
      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#1f1e1b] px-5 text-base font-semibold text-white transition-colors hover:bg-[#34322d] disabled:cursor-not-allowed disabled:bg-[#dedbd4] disabled:text-[#98938a]"
      >
        {isProcessing ? <LoaderCircle className="animate-spin" size={18} /> : <Play size={18} fill="currentColor" />}
        {isProcessing ? "处理中" : isConvertMode ? "开始转换" : "开始分离"}
      </button>
      <StatusBar statusText={statusText} progress={progress} isProcessing={isProcessing} />
      {error ? <Message tone="error" text={error} actionLabel="重新尝试" onAction={onSubmit} /> : null}
      {warning ? <Message tone="warning" text={warning} /> : null}
    </Card>
  );
}

function PracticePanel() {
  const options = ["AB Loop", "变速", "变调"];
  return (
    <Card>
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={17} className="text-[#665f55]" aria-hidden="true" />
        <SectionLabel>PRACTICE / 练习模式</SectionLabel>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {options.map((label) => (
          <button key={label} type="button" disabled className="h-11 rounded-[12px] border border-[#ded9cf] bg-[#f5f2ec] text-sm font-semibold text-[#9a958c] disabled:cursor-not-allowed">
            {label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-[#7a746b]">AB Loop、变速与变调功能开发中。</p>
    </Card>
  );
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`w-full min-w-0 rounded-[18px] border border-[#e4e0d7] bg-[#fffefc] p-[18px] shadow-[0_10px_30px_rgba(55,45,30,0.04)] sm:p-6 ${className}`}>{children}</section>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#827869]">{children}</div>;
}

function ChoiceButton({
  active,
  label,
  description,
  badge,
  disabled = false,
  onClick
}: {
  active: boolean;
  label: string;
  description: string;
  badge?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-[106px] min-w-0 rounded-[14px] border p-4 text-left transition-colors ${active ? "border-[#2c2a25] bg-[#fffdf8]" : "border-[#ded9cf] bg-[#faf8f3] hover:border-[#8b8377] hover:bg-white"} disabled:cursor-not-allowed`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#26241f]">{label}</span>
            {badge ? <span className="rounded-full bg-[#eee5d4] px-2 py-0.5 text-[11px] font-semibold text-[#6e604a]">{badge}</span> : null}
          </span>
          <span className="mt-2 block text-sm leading-6 text-[#777168]">{description}</span>
        </span>
        <span className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${active ? "border-[#282621] bg-[#282621] shadow-[inset_0_0_0_3px_#282621]" : "border-[#aaa397] bg-white"}`} aria-hidden="true" />
      </span>
    </button>
  );
}

function StatusBar({ statusText, progress, isProcessing }: { statusText: string; progress: number; isProcessing: boolean }) {
  return (
    <div className="mt-4 rounded-[14px] border border-[#e3ded4] bg-[#faf8f3] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 truncate text-sm font-semibold text-[#312e29]">{statusText}</div>
        <div className="shrink-0 text-xs font-medium tabular-nums text-[#777168]">{Math.round(progress)}%</div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e6e0d6]">
        <div className={`h-full rounded-full bg-[#6c6255] transition-all duration-500 ${isProcessing ? "animate-pulse" : ""}`} style={{ width: `${clampProgress(progress)}%` }} />
      </div>
    </div>
  );
}

function ResultPanel({
  title,
  subtitle,
  src,
  downloadHref,
  downloadLabel,
  downloadName
}: {
  title: string;
  subtitle: string;
  src: string;
  downloadHref: string;
  downloadLabel: string;
  downloadName?: string;
}) {
  return (
    <div className="rounded-[14px] border border-[#e1dcd2] bg-[#faf8f3] p-4">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#827869]">{subtitle}</div>
        <div className="mt-2 truncate text-lg font-semibold text-[#201f1c]">{title}</div>
      </div>
      <AudioPlayer src={src} label={title} />
      <a href={downloadHref} download={downloadName || `${subtitle.toLowerCase().replaceAll(" ", "_")}.mp3`} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-[#211f1c] bg-[#211f1c] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#38352f]">
        <Download size={16} aria-hidden="true" />{downloadLabel}
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
      setCurrentTime(0); setDuration(0); setPlaying(false); audio.pause(); audio.currentTime = 0; audio.load();
    }, 0);
    const durationTimer = window.setTimeout(() => readAudioDuration(audio, setDuration), 200);
    return () => { window.clearTimeout(resetTimer); window.clearTimeout(durationTimer); };
  }, [src]);

  const canSeek = duration > 0;
  const safeCurrentTime = clampPlaybackTime(currentTime, duration);
  const filled = progressPercent(safeCurrentTime, duration);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play(); else audio.pause();
  }

  function seek(value: string) {
    const audio = audioRef.current;
    const nextTime = clampPlaybackTime(Number(value), duration);
    setCurrentTime(nextTime);
    if (audio && canSeek) audio.currentTime = nextTime;
  }

  return (
    <div className="min-w-0 rounded-[12px] border border-[#e4e0d7] bg-white px-3 py-4 sm:px-4">
      <audio ref={audioRef} preload="metadata" src={src} onLoadedMetadata={(event) => readAudioDuration(event.currentTarget, setDuration)} onDurationChange={(event) => readAudioDuration(event.currentTarget, setDuration)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={(event) => { setPlaying(false); setCurrentTime(event.currentTarget.duration || 0); }} />
      <div className="grid min-w-0 grid-cols-[2rem_4.1rem_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <button type="button" onClick={togglePlayback} className="flex h-8 w-8 items-center justify-center rounded-full text-[#24221e] hover:bg-[#ece7dd]" aria-label={`${playing ? "暂停" : "播放"} ${label}`}>
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <div className="font-mono text-xs tabular-nums text-[#3b3832] sm:text-sm"><div>{formatPlaybackTime(safeCurrentTime)}</div><div className="text-[#918c83]">{formatPlaybackTime(duration)}</div></div>
        <input type="range" min="0" max={duration > 0 ? duration : 1} step="0.01" value={duration > 0 ? safeCurrentTime : 0} disabled={!canSeek} onChange={(event) => seek(event.target.value)} aria-label={`${label} 播放进度`} className="h-7 min-w-0 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed" style={{ background: `linear-gradient(to right, #292722 0%, #292722 ${filled}%, rgba(41,39,34,.15) ${filled}%, rgba(41,39,34,.15) 100%)` }} />
      </div>
    </div>
  );
}

function Message({ tone, text, actionLabel, onAction }: { tone: "error" | "warning"; text: string; actionLabel?: string; onAction?: () => void }) {
  const isError = tone === "error";
  return (
    <div className={`mt-4 flex flex-wrap items-start gap-2 rounded-[12px] px-4 py-3 text-sm ${isError ? "bg-[#fff0f1] text-[#8b2731]" : "bg-[#f7f1df] text-[#6f5a1c]"}`} role={isError ? "alert" : "status"}>
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 leading-6">{text}</span>
      {actionLabel && onAction ? <button type="button" onClick={onAction} className="inline-flex items-center gap-1 font-semibold underline underline-offset-4"><RotateCcw size={14} />{actionLabel}</button> : null}
    </div>
  );
}

function uiModeToJobMode(mode: UiMode): JobMode {
  return mode === "standard" ? "balanced" : mode;
}

function buildResultState(job: JobRecord, fallbackTargetLabel: string): ResultState | null {
  const converted = job.files?.converted;
  if (converted) return { convertedUrl: converted.url, convertedLabel: converted.label, convertedDownloadName: fileNameFromUrl(converted.url) };
  const isolated = job.files?.isolated;
  const backing = job.files?.backing;
  if (!isolated || !backing) return null;
  return { isolatedUrl: isolated.url, backingUrl: backing.url, isolatedLabel: isolated.label, backingLabel: backing.label, targetLabel: job.targetLabel || fallbackTargetLabel };
}

function toUserError(error: unknown) {
  if (!(error instanceof Error)) return API_UNAVAILABLE_ERROR;
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) return API_UNAVAILABLE_ERROR;
  return error.message || "处理失败，请重新尝试。";
}

function fileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url, "http://localhost").pathname;
    return decodeURIComponent(pathname.split("/").pop() || "converted.mp3");
  } catch {
    return "converted.mp3";
  }
}

function clampProgress(progress: number) {
  return Math.max(0, Math.min(progress, 100));
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function readAudioDuration(audio: HTMLAudioElement, setDuration: (duration: number) => void) {
  if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
}
