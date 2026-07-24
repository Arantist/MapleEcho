from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
import sys
from pathlib import Path

NCM_MAGIC = bytes.fromhex("4354454e4644414d")
NCM_TIMEOUT_SECONDS = 300

INVALID_NCM_FILE = "INVALID_NCM_FILE"
NCM_CONVERTER_UNAVAILABLE = "NCM_CONVERTER_UNAVAILABLE"
NCM_CONVERSION_FAILED = "NCM_CONVERSION_FAILED"
NCM_CONVERSION_TIMEOUT = "NCM_CONVERSION_TIMEOUT"
NCM_OUTPUT_INVALID = "NCM_OUTPUT_INVALID"

NCM_ERROR_MESSAGES = {
    INVALID_NCM_FILE: "无法识别该 NCM 文件，请确认文件完整后重试。",
    NCM_CONVERTER_UNAVAILABLE: "NCM 转换服务暂时不可用，请稍后重试。",
    NCM_CONVERSION_FAILED: "NCM 文件转换失败，请更换文件后重试。",
    NCM_CONVERSION_TIMEOUT: "NCM 文件转换超时，请稍后重试。",
    NCM_OUTPUT_INVALID: "文件已转换，但未检测到有效音频内容。",
}


class NcmConversionError(RuntimeError):
    def __init__(self, code: str, detail: str | None = None) -> None:
        self.code = code
        self.detail = detail or NCM_ERROR_MESSAGES.get(code, "NCM 文件转换失败，请更换文件后重试。")
        super().__init__(self.detail)


def convert_ncm_to_standard_audio(input_path: Path, work_dir: Path) -> Path:
    validate_ncm_file(input_path)
    work_dir.mkdir(parents=True, exist_ok=True)
    before = {path.resolve() for path in work_dir.iterdir()} if work_dir.exists() else set()
    run_ncmdump(input_path, work_dir)
    output_path = find_decoded_audio(work_dir, input_path.stem, before)
    if output_path is None:
        raise NcmConversionError(NCM_CONVERSION_FAILED)
    validate_audio(output_path)
    return output_path


def convert_ncm_to_mp3(input_path: Path, work_dir: Path, output_path: Path) -> Path:
    decoded_path = convert_ncm_to_standard_audio(input_path, work_dir)
    return convert_audio_to_mp3(decoded_path, output_path)


def convert_audio_to_mp3(input_path: Path, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if input_path.suffix.lower() == ".mp3":
        if input_path.resolve() != output_path.resolve():
            shutil.copyfile(input_path, output_path)
    else:
        run_ffmpeg_to_mp3(input_path, output_path)
    validate_audio(output_path)
    return output_path


def validate_ncm_file(input_path: Path) -> None:
    try:
        with input_path.open("rb") as source:
            header = source.read(len(NCM_MAGIC))
    except OSError as error:
        raise NcmConversionError(INVALID_NCM_FILE) from error
    if header != NCM_MAGIC:
        raise NcmConversionError(INVALID_NCM_FILE)


def run_ncmdump(input_path: Path, output_dir: Path) -> None:
    if not ncmdump_available():
        raise NcmConversionError(NCM_CONVERTER_UNAVAILABLE, "ncmdump dependency is unavailable")

    timeout = int(os.getenv("NCM_CONVERSION_TIMEOUT_SECONDS", str(NCM_TIMEOUT_SECONDS)))
    command = [
        sys.executable,
        "-m",
        "ncmdump.app",
        "-o",
        str(output_dir),
        "-c",
        str(input_path),
    ]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired as error:
        raise NcmConversionError(NCM_CONVERSION_TIMEOUT) from error
    if completed.returncode != 0:
        raise NcmConversionError(NCM_CONVERSION_FAILED, tail(completed.stderr or completed.stdout))


def ncmdump_available() -> bool:
    try:
        return importlib.util.find_spec("ncmdump") is not None
    except (ImportError, ModuleNotFoundError, ValueError):
        return False


def run_ffmpeg_to_mp3(input_path: Path, output_path: Path) -> None:
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-vn",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "320k",
        str(output_path),
    ]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        raise NcmConversionError(NCM_CONVERSION_FAILED, tail(completed.stderr or completed.stdout))


def validate_audio(path: Path) -> None:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0 or "audio" not in completed.stdout.lower():
        raise NcmConversionError(NCM_OUTPUT_INVALID)


def find_decoded_audio(work_dir: Path, preferred_stem: str, before: set[Path]) -> Path | None:
    candidates = [
        path
        for path in work_dir.iterdir()
        if path.is_file() and path.suffix.lower() in {".mp3", ".flac"} and path.resolve() not in before
    ]
    if not candidates:
        return None
    for path in candidates:
        if path.stem == preferred_stem:
            return path
    return sorted(candidates, key=lambda path: path.stat().st_mtime, reverse=True)[0]


def tail(value: str, limit: int = 1200) -> str:
    cleaned = value.strip()
    if not cleaned:
        return NCM_ERROR_MESSAGES[NCM_CONVERSION_FAILED]
    return cleaned[-limit:]
