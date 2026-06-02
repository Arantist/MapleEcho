from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from demucs_runner import DemucsError, run_demucs

JobStatus = Literal["queued", "processing", "completed", "failed"]
JobMode = Literal["fast", "quality"]


@dataclass
class JobRecord:
    job_id: str
    status: JobStatus
    progress: int
    message: str
    mode: JobMode
    input_path: Path
    job_dir: Path


jobs: dict[str, JobRecord] = {}


def run_job(job_id: str) -> None:
    job = jobs[job_id]
    try:
        job.status = "processing"
        job.progress = 10
        job.message = "正在启动 Demucs。"
        run_demucs(job.input_path, job.job_dir, job.mode, progress=lambda value, message: update(job, value, message))
        job.status = "completed"
        job.progress = 100
        job.message = "分离完成。"
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
