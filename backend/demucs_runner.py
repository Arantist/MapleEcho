from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Callable, Literal

JobMode = Literal["balanced", "quality"]
TargetStem = Literal["guitar", "bass", "drums", "vocals"]


class DemucsError(RuntimeError):
    pass


def run_demucs(input_path: Path, job_dir: Path, mode: JobMode, target: TargetStem, progress: Callable[[int, str], None]) -> None:
    output_root = job_dir / "output"
    result_dir = job_dir / "result"
    output_root.mkdir(parents=True, exist_ok=True)
    result_dir.mkdir(parents=True, exist_ok=True)

    model = demucs_model(target)
    bitrate = "320" if mode == "quality" else "256"
    preset = "2" if mode == "quality" else "4"
    progress(20, f"正在使用 {model} 模型分离 {target}。")
    command = [
        sys.executable,
        "-m",
        "demucs",
        "-n",
        model,
        f"--two-stems={target}",
        "--mp3",
        "--mp3-bitrate",
        bitrate,
        "--mp3-preset",
        preset,
        "--out",
        str(output_root),
    ]
    if mode == "quality":
        command.extend(["--overlap", "0.35", "--shifts", "2"])
    command.append(str(input_path))

    timeout = int(os.getenv("DEMUCS_TIMEOUT_SECONDS", "7200"))
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired as error:
        raise DemucsError(f"Demucs 运行超时。质量模式模型下载或处理可能太慢，请改用快速模式后重试。") from error

    if completed.returncode != 0:
        detail = tail(completed.stderr or completed.stdout)
        if mode == "quality":
            raise DemucsError(f"质量模式 {model} 下载或运行失败：{detail}")
        raise DemucsError(f"Demucs 运行失败：{detail}")

    progress(90, "正在整理输出文件。")
    isolated = find_output(output_root, f"{target}.mp3")
    backing_name = f"no_{target}.mp3"
    backing = find_output(output_root, backing_name)
    stems = {f"{target}.mp3": isolated, backing_name: backing}
    missing = [name for name, path in stems.items() if path is None]
    if missing:
        raise DemucsError(f"Demucs 没有生成这些 MP3 文件：{', '.join(missing)}。")

    shutil.copyfile(isolated, result_dir / f"{target}.mp3")
    shutil.copyfile(backing, result_dir / backing_name)
    shutil.rmtree(output_root, ignore_errors=True)
    input_path.unlink(missing_ok=True)


def demucs_model(target: TargetStem) -> str:
    return "htdemucs_6s" if target == "guitar" else "htdemucs"


def find_output(root: Path, filename: str) -> Path | None:
    for path in root.rglob(filename):
        return path
    return None


def tail(value: str, limit: int = 1200) -> str:
    cleaned = value.strip()
    if not cleaned:
        return "没有错误输出。"
    return cleaned[-limit:]

