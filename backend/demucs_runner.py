from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Callable, Literal

JobMode = Literal["fast", "quality"]


class DemucsError(RuntimeError):
    pass


def run_demucs(input_path: Path, job_dir: Path, mode: JobMode, progress: Callable[[int, str], None]) -> None:
    output_root = job_dir / "output"
    result_dir = job_dir / "result"
    output_root.mkdir(parents=True, exist_ok=True)
    result_dir.mkdir(parents=True, exist_ok=True)

    model = "htdemucs_6s"
    shifts = "1" if mode == "fast" else "2"
    progress(20, f"正在使用 {model} 模型分离音频。")
    command = [
        sys.executable,
        "-m",
        "demucs",
        "-n",
        model,
        "--shifts",
        shifts,
        "-d",
        "cpu",
        "--out",
        str(output_root),
        str(input_path),
    ]

    timeout = int(os.getenv("DEMUCS_TIMEOUT_SECONDS", "7200"))
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired as error:
        raise DemucsError(f"Demucs 运行超时。质量模式模型下载或处理可能太慢，请改用快速模式后重试。") from error

    if completed.returncode != 0:
        detail = tail(completed.stderr or completed.stdout)
        if mode == "quality":
            raise DemucsError(f"质量模式 htdemucs_ft 下载或运行失败：{detail}")
        raise DemucsError(f"Demucs 运行失败：{detail}")

    progress(90, "正在整理输出文件。")
    vocals = find_output(output_root, "vocals.wav")
    drums = find_output(output_root, "drums.wav")
    bass = find_output(output_root, "bass.wav")
    other = find_output(output_root, "other.wav")
    guitar = find_output(output_root, "guitar.wav")
    piano = find_output(output_root, "piano.wav")
    stems = {
        "vocals": vocals,
        "drums": drums,
        "bass": bass,
        "other": other,
        "guitar": guitar,
        "piano": piano,
    }
    missing = [name for name, path in stems.items() if path is None]
    if missing:
        raise DemucsError(f"Demucs 没有生成这些 6-stem 文件：{', '.join(missing)}。")

    shutil.copyfile(vocals, result_dir / "vocals.wav")
    shutil.copyfile(guitar, result_dir / "guitar.wav")
    mix_audio([drums, bass, other, guitar, piano], result_dir / "instrumental.wav")
    mix_audio([vocals, drums, bass, other, piano], result_dir / "no_guitar.wav")


def find_output(root: Path, filename: str) -> Path | None:
    for path in root.rglob(filename):
        return path
    return None


def tail(value: str, limit: int = 1200) -> str:
    cleaned = value.strip()
    if not cleaned:
        return "没有错误输出。"
    return cleaned[-limit:]


def mix_audio(input_files: list[Path], output_file: Path) -> None:
    command = ["ffmpeg", "-y"]
    for input_file in input_files:
        command.extend(["-i", str(input_file)])
    command.extend([
        "-filter_complex",
        f"amix=inputs={len(input_files)}:duration=longest:normalize=0,alimiter=limit=0.98",
        "-c:a",
        "pcm_s16le",
        str(output_file),
    ])
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        raise DemucsError(f"ffmpeg 混音失败：{tail(completed.stderr or completed.stdout)}")
