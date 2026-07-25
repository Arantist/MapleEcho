from __future__ import annotations

import logging
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from demucs_runner import DemucsError, TargetStem, run_demucs
from ncm_converter import (
    NCM_ERROR_MESSAGES,
    NcmConversionError,
    convert_audio_to_mp3,
    convert_ncm_to_mp3,
    convert_ncm_to_standard_audio,
)

JobStatus = Literal["queued", "processing", "completed", "failed"]
JobMode = Literal["balanced", "quality", "convert"]
logger = logging.getLogger(__name__)


@dataclass
class JobRecord:
    job_id: str
    status: JobStatus
    progress: int
    message: str
    mode: JobMode
    target: TargetStem
    bitrate: int
    input_path: Path
    job_dir: Path
    original_name: str
    converted_filename: str | None = None
    error_code: str | None = None


jobs: dict[str, JobRecord] = {}


def run_job(job_id: str) -> None:
    job = jobs[job_id]
    try:
        job.status = "processing"
        job.progress = 10
        job.error_code = None
        if job.mode == "convert":
            run_convert_job(job)
            return

        demucs_input_path = job.input_path
        if is_ncm_file(job.input_path):
            job.message = "正在转换 NCM 文件。"
            demucs_input_path = convert_ncm_to_standard_audio(job.input_path, job.job_dir / "converted")
            job.progress = 18
            job.message = "NCM 转换完成，正在启动 Demucs。"
        else:
            job.message = "正在启动 Demucs。"

        run_demucs(demucs_input_path, job.job_dir, job.mode, job.target, progress=lambda value, message: update(job, value, message))
        cleanup_successful_input(job)
        job.status = "completed"
        job.progress = 100
        job.message = "分离完成。"
    except NcmConversionError as error:
        logger.error("NCM conversion failed for job %s (%s): %s", job.job_id, error.code, error.detail)
        job.status = "failed"
        job.progress = 100
        job.error_code = error.code
        job.message = NCM_ERROR_MESSAGES.get(error.code, str(error))
    except DemucsError as error:
        job.status = "failed"
        job.progress = 100
        job.message = str(error)
    except Exception as error:
        job.status = "failed"
        job.progress = 100
        job.message = f"音频分离失败：{error}"


def update(job: JobRecord, progress: int, message: str) -> None:
    job.progress = progress
    job.message = message


def run_convert_job(job: JobRecord) -> None:
    job.progress = 20
    result_dir = job.job_dir / "result"
    result_dir.mkdir(parents=True, exist_ok=True)
    job.converted_filename = converted_output_filename(job.original_name)
    output_path = result_dir / job.converted_filename

    if is_ncm_file(job.input_path):
        job.message = "正在转换 NCM 文件。"
        convert_ncm_to_mp3(job.input_path, job.job_dir / "converted", output_path)
    else:
        job.message = "正在转换为 MP3。"
        convert_audio_to_mp3(job.input_path, output_path)

    cleanup_successful_input(job)
    job.status = "completed"
    job.progress = 100
    job.message = "转换完成。"


def converted_output_filename(original_name: str) -> str:
    name = Path(original_name).name
    stem = name.rsplit(".", 1)[0].strip() if "." in name else name.strip()
    if not stem:
        stem = "converted"
    return f"{stem}-converted.mp3"


def is_ncm_file(path: Path) -> bool:
    return path.suffix.lower() == ".ncm"


def cleanup_successful_input(job: JobRecord) -> None:
    job.input_path.unlink(missing_ok=True)
    shutil.rmtree(job.job_dir / "converted", ignore_errors=True)
