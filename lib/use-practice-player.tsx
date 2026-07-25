"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import {
  clampLoopPoint,
  clampPitchSemitones,
  clampPlaybackRate,
  clampPlaybackTime,
  hasValidLoop
} from "@/lib/player";
import type { PracticeTrack, PracticeTrackId } from "@/lib/types";

type PitchEngineStatus = "idle" | "loading" | "ready" | "unavailable";

export type PracticePlayer = {
  activeTrackId: PracticeTrackId | null;
  currentTime: number;
  duration: number;
  playing: boolean;
  playbackRate: number;
  pitchSemitones: number;
  loopStart: number;
  loopEnd: number;
  loopEnabled: boolean;
  pitchEngineStatus: PitchEngineStatus;
  message: string;
  switchTrack: (trackId: PracticeTrackId, autoplay?: boolean) => Promise<void>;
  toggleTrackPlayback: (trackId: PracticeTrackId) => Promise<void>;
  seek: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  setPitchSemitones: (semitones: number) => Promise<void>;
  setLoopStart: (seconds: number) => boolean;
  setLoopEnd: (seconds: number) => boolean;
  setLoopStartAtCurrentTime: () => void;
  setLoopEndAtCurrentTime: () => void;
  setLoopEnabled: (enabled: boolean) => void;
  resetLoop: () => void;
};

type PracticePlayerResult = {
  player: PracticePlayer;
  audioElement: ReactNode;
};

export function usePracticePlayer(
  tracks: PracticeTrack[],
  defaultTrackId: PracticeTrackId | null
): PracticePlayerResult {
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeTrackIdRef = useRef<PracticeTrackId | null>(null);
  const loopStartRef = useRef(0);
  const loopEndRef = useRef(0);
  const loopEnabledRef = useRef(false);
  const playbackRateRef = useRef(1);
  const pitchSemitonesRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundTouchNodeRef = useRef<SoundTouchNode | null>(null);
  const directGainRef = useRef<GainNode | null>(null);
  const shiftedGainRef = useRef<GainNode | null>(null);
  const enginePromiseRef = useRef<Promise<SoundTouchNode> | null>(null);

  const [activeTrackId, setActiveTrackIdState] = useState<PracticeTrackId | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [pitchSemitones, setPitchSemitonesState] = useState(0);
  const [loopStart, setLoopStartState] = useState(0);
  const [loopEnd, setLoopEndState] = useState(0);
  const [loopEnabled, setLoopEnabledState] = useState(false);
  const [pitchEngineStatus, setPitchEngineStatus] = useState<PitchEngineStatus>("idle");
  const [message, setMessage] = useState("");

  const setActiveTrackId = useCallback((trackId: PracticeTrackId | null) => {
    activeTrackIdRef.current = trackId;
    setActiveTrackIdState(trackId);
  }, []);

  const updateLoopStart = useCallback((value: number) => {
    loopStartRef.current = value;
    setLoopStartState(value);
  }, []);

  const updateLoopEnd = useCallback((value: number) => {
    loopEndRef.current = value;
    setLoopEndState(value);
  }, []);

  const setLoopEnabled = useCallback((enabled: boolean) => {
    const nextEnabled = enabled && hasValidLoop(loopStartRef.current, loopEndRef.current, duration);
    loopEnabledRef.current = nextEnabled;
    setLoopEnabledState(nextEnabled);
    if (enabled && !nextEnabled) setMessage("请先设置至少 0.1 秒的有效 A、B 区间。");
    else setMessage("");
  }, [duration]);

  const resetLoop = useCallback(() => {
    updateLoopStart(0);
    updateLoopEnd(duration);
    loopEnabledRef.current = false;
    setLoopEnabledState(false);
    setMessage("");
  }, [duration, updateLoopEnd, updateLoopStart]);

  const applyAudioSettings = useCallback((rate: number, semitones: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = rate;
      audio.defaultPlaybackRate = rate;
      audio.preservesPitch = semitones === 0;
      const webkitAudio = audio as HTMLAudioElement & { webkitPreservesPitch?: boolean };
      if ("webkitPreservesPitch" in webkitAudio) webkitAudio.webkitPreservesPitch = semitones === 0;
    }

    const context = audioContextRef.current;
    const node = soundTouchNodeRef.current;
    const directGain = directGainRef.current;
    const shiftedGain = shiftedGainRef.current;
    if (!context || !node || !directGain || !shiftedGain) return;

    node.playbackRate.setValueAtTime(rate, context.currentTime);
    node.pitchSemitones.setValueAtTime(semitones, context.currentTime);
    directGain.gain.setValueAtTime(semitones === 0 ? 1 : 0, context.currentTime);
    shiftedGain.gain.setValueAtTime(semitones === 0 ? 0 : 1, context.currentTime);
  }, []);

  const ensurePitchEngine = useCallback(async () => {
    if (soundTouchNodeRef.current) return soundTouchNodeRef.current;
    if (enginePromiseRef.current) return enginePromiseRef.current;

    const audio = audioRef.current;
    const AudioContextConstructor = window.AudioContext;
    if (!audio || !AudioContextConstructor) {
      setPitchEngineStatus("unavailable");
      throw new Error("当前浏览器不支持 Web Audio 变调。");
    }

    const context = new AudioContextConstructor();
    if (!context.audioWorklet) {
      await context.close();
      setPitchEngineStatus("unavailable");
      throw new Error("当前浏览器不支持 AudioWorklet 变调。");
    }

    audioContextRef.current = context;
    setPitchEngineStatus("loading");
    enginePromiseRef.current = (async () => {
      const { SoundTouchNode: SoundTouchNodeConstructor } = await import("@soundtouchjs/audio-worklet");
      await SoundTouchNodeConstructor.register(context, "/soundtouch-processor.js");

      const directGain = context.createGain();
      const shiftedGain = context.createGain();
      const soundTouchNode = new SoundTouchNodeConstructor({ context });
      const source = context.createMediaElementSource(audio);

      source.connect(directGain).connect(context.destination);
      source.connect(soundTouchNode).connect(shiftedGain).connect(context.destination);
      directGainRef.current = directGain;
      shiftedGainRef.current = shiftedGain;
      soundTouchNodeRef.current = soundTouchNode;
      applyAudioSettings(playbackRateRef.current, pitchSemitonesRef.current);
      await context.resume();
      setPitchEngineStatus("ready");
      return soundTouchNode;
    })().catch(async (error: unknown) => {
      enginePromiseRef.current = null;
      setPitchEngineStatus("unavailable");
      if (context.state !== "closed") await context.close();
      audioContextRef.current = null;
      throw error;
    });

    return enginePromiseRef.current;
  }, [applyAudioSettings]);

  const switchTrack = useCallback(async (trackId: PracticeTrackId, autoplay = false) => {
    const track = tracks.find((item) => item.id === trackId);
    const audio = audioRef.current;
    if (!track || !audio) return;

    if (activeTrackIdRef.current !== trackId || audio.getAttribute("src") !== track.url) {
      audio.pause();
      setPlaying(false);
      audio.src = track.url;
      audio.load();
      setActiveTrackId(trackId);
      setCurrentTime(0);
      setDuration(0);
      updateLoopStart(0);
      updateLoopEnd(0);
      loopEnabledRef.current = false;
      setLoopEnabledState(false);
      setMessage("");
      applyAudioSettings(playbackRateRef.current, pitchSemitonesRef.current);
    }

    if (autoplay) {
      try {
        if (pitchSemitonesRef.current !== 0) await ensurePitchEngine();
        if (audioContextRef.current?.state === "suspended") await audioContextRef.current.resume();
        await audio.play();
      } catch {
        setMessage("播放启动失败，请再次点击播放。");
      }
    }
  }, [applyAudioSettings, ensurePitchEngine, setActiveTrackId, tracks, updateLoopEnd, updateLoopStart]);

  const toggleTrackPlayback = useCallback(async (trackId: PracticeTrackId) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (activeTrackIdRef.current !== trackId) {
      await switchTrack(trackId, true);
      return;
    }
    if (audio.paused) await switchTrack(trackId, true);
    else audio.pause();
  }, [switchTrack]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    const nextTime = clampPlaybackTime(seconds, duration);
    setCurrentTime(nextTime);
    if (audio && duration > 0) audio.currentTime = nextTime;
  }, [duration]);

  const setPlaybackRate = useCallback((rate: number) => {
    const nextRate = clampPlaybackRate(rate);
    playbackRateRef.current = nextRate;
    setPlaybackRateState(nextRate);
    applyAudioSettings(nextRate, pitchSemitonesRef.current);
  }, [applyAudioSettings]);

  const setPitchSemitones = useCallback(async (semitones: number) => {
    const nextSemitones = clampPitchSemitones(semitones);
    if (nextSemitones !== 0) {
      try {
        await ensurePitchEngine();
      } catch {
        pitchSemitonesRef.current = 0;
        setPitchSemitonesState(0);
        applyAudioSettings(playbackRateRef.current, 0);
        setMessage("变调引擎加载失败，普通播放、AB Loop 和变速仍可使用。");
        return;
      }
    }

    pitchSemitonesRef.current = nextSemitones;
    setPitchSemitonesState(nextSemitones);
    applyAudioSettings(playbackRateRef.current, nextSemitones);
    setMessage("");
  }, [applyAudioSettings, ensurePitchEngine]);

  const setLoopStart = useCallback((seconds: number) => {
    if (duration <= 0) return false;
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > duration) {
      setMessage(`A 点需在 0:00–${formatLoopTime(duration)} 之间。`);
      return false;
    }
    if (seconds > loopEndRef.current - 0.1) {
      setMessage("A 点必须早于 B 点。");
      return false;
    }
    updateLoopStart(seconds);
    setMessage("");
    return true;
  }, [duration, updateLoopStart]);

  const setLoopEnd = useCallback((seconds: number) => {
    if (duration <= 0) return false;
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > duration) {
      setMessage(`B 点需在 0:00–${formatLoopTime(duration)} 之间。`);
      return false;
    }
    if (seconds < loopStartRef.current + 0.1) {
      setMessage("B 点必须晚于 A 点。");
      return false;
    }
    updateLoopEnd(seconds);
    setMessage("");
    return true;
  }, [duration, updateLoopEnd]);

  const setLoopStartAtCurrentTime = useCallback(() => {
    if (duration <= 0) return;
    const maximum = Math.max(loopEndRef.current - 0.1, 0);
    const nextStart = Math.min(clampLoopPoint(audioRef.current?.currentTime ?? 0, duration), maximum);
    updateLoopStart(nextStart);
    setMessage("");
  }, [duration, updateLoopStart]);

  const setLoopEndAtCurrentTime = useCallback(() => {
    if (duration <= 0) return;
    const minimum = Math.min(loopStartRef.current + 0.1, duration);
    const nextEnd = Math.max(clampLoopPoint(audioRef.current?.currentTime ?? duration, duration), minimum);
    updateLoopEnd(nextEnd);
    setMessage("");
  }, [duration, updateLoopEnd]);

  const updateDuration = useCallback((audio: HTMLAudioElement) => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    setDuration(audio.duration);
    if (loopEndRef.current <= 0 || loopEndRef.current > audio.duration) updateLoopEnd(audio.duration);
  }, [updateLoopEnd]);

  const checkLoopBoundary = useCallback((audio: HTMLAudioElement) => {
    if (
      loopEnabledRef.current &&
      hasValidLoop(loopStartRef.current, loopEndRef.current, audio.duration) &&
      audio.currentTime >= loopEndRef.current - 0.025
    ) {
      audio.currentTime = loopStartRef.current;
      setCurrentTime(loopStartRef.current);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    const nextTrack = tracks.find((track) => track.id === defaultTrackId) ?? tracks[0];
    audio?.pause();
    if (!audio || !nextTrack) {
      if (audio) {
        audio.removeAttribute("src");
        audio.load();
      }
      setActiveTrackId(null);
      setCurrentTime(0);
      setDuration(0);
      updateLoopStart(0);
      updateLoopEnd(0);
      loopEnabledRef.current = false;
      setLoopEnabledState(false);
      return;
    }

    audio.src = nextTrack.url;
    audio.load();
    setActiveTrackId(nextTrack.id);
    setCurrentTime(0);
    setDuration(0);
    updateLoopStart(0);
    updateLoopEnd(0);
    loopEnabledRef.current = false;
    setLoopEnabledState(false);
    setMessage("");
    applyAudioSettings(playbackRateRef.current, pitchSemitonesRef.current);
  }, [applyAudioSettings, defaultTrackId, setActiveTrackId, tracks, updateLoopEnd, updateLoopStart]);

  useEffect(() => {
    if (!playing || !loopEnabled) return;
    let frame = 0;
    const monitor = () => {
      const audio = audioRef.current;
      if (audio) checkLoopBoundary(audio);
      frame = window.requestAnimationFrame(monitor);
    };
    frame = window.requestAnimationFrame(monitor);
    return () => window.cancelAnimationFrame(frame);
  }, [checkLoopBoundary, loopEnabled, playing]);

  useEffect(() => () => {
    const context = audioContextRef.current;
    if (context && context.state !== "closed") void context.close();
  }, []);

  const audioElement = (
    <audio
      ref={audioRef}
      className="hidden"
      crossOrigin="anonymous"
      preload="metadata"
      aria-hidden="true"
      onLoadedMetadata={(event) => updateDuration(event.currentTarget)}
      onDurationChange={(event) => updateDuration(event.currentTarget)}
      onTimeUpdate={(event) => {
        if (!checkLoopBoundary(event.currentTarget)) setCurrentTime(event.currentTarget.currentTime);
      }}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={(event) => {
        if (loopEnabledRef.current && hasValidLoop(loopStartRef.current, loopEndRef.current, event.currentTarget.duration)) {
          event.currentTarget.currentTime = loopStartRef.current;
          void event.currentTarget.play();
          return;
        }
        setPlaying(false);
        setCurrentTime(event.currentTarget.duration || 0);
      }}
      onError={() => {
        setPlaying(false);
        setMessage("音频加载失败，请检查结果链接后重试。");
      }}
    />
  );

  return {
    audioElement,
    player: {
      activeTrackId,
      currentTime,
      duration,
      playing,
      playbackRate,
      pitchSemitones,
      loopStart,
      loopEnd,
      loopEnabled,
      pitchEngineStatus,
      message,
      switchTrack,
      toggleTrackPlayback,
      seek,
      setPlaybackRate,
      setPitchSemitones,
      setLoopStart,
      setLoopEnd,
      setLoopStartAtCurrentTime,
      setLoopEndAtCurrentTime,
      setLoopEnabled,
      resetLoop
    }
  };
}

function formatLoopTime(seconds: number) {
  const wholeSeconds = Math.floor(Math.max(seconds, 0));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}
