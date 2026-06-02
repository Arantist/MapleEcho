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

    model = "mdx_q" if mode == "fast" else "htdemucs_ft"
    progress(20, f"正在使用 {model} 模型分离音频。")
    command = [
        sys.executable,
        "-m",
        "demucs",
        "--two-stems=vocals",
        "-n",
        model,
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
    instrumental = find_output(output_root, "no_vocals.wav")
    if not vocals or not instrumental:
        raise DemucsError("Demucs 没有生成 vocals.wav 或 no_vocals.wav。")

    shutil.copyfile(vocals, result_dir / "vocals.wav")
    shutil.copyfile(instrumental, result_dir / "instrumental.wav")


def find_output(root: Path, filename: str) -> Path | None:
    for path in root.rglob(filename):
        return path
    return None


def tail(value: str, limit: int = 1200) -> str:
    cleaned = value.strip()
    if not cleaned:
        return "没有错误输出。"
    return cleaned[-limit:]
