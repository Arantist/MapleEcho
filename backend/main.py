from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from worker import JobMode, JobRecord, converted_output_filename, jobs, run_job

SERVICE_NAME = "mapleecho-backend"
JOBS_ROOT = Path("/tmp/audio-jobs")
MAX_UPLOAD_SIZE = 100 * 1024 * 1024
ALLOWED_EXTENSIONS = {"mp3", "wav", "flac", "m4a", "aac", "ogg", "ncm"}
TARGET_LABELS = {
    "guitar": "电吉他",
    "bass": "贝斯",
    "drums": "鼓点",
    "vocals": "人声",
}

app = FastAPI(title=SERVICE_NAME)


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Accept-Ranges", "Content-Length", "Content-Range"],
)


@app.get("/health")
def health() -> dict[str, bool | int | float | str | list[str]]:
    return {
        "ok": True,
        "service": SERVICE_NAME,
        "ffmpeg": executable_exists("ffmpeg"),
        "ffprobe": executable_exists("ffprobe"),
        "python": Path(sys.executable).exists(),
        "demucs": executable_exists("demucs") or python_module_exists("demucs"),
        "torch": python_module_exists("torch"),
        "cpuCores": os.cpu_count() or 1,
        "memoryGb": memory_gb(),
        "pythonVersion": platform.python_version(),
        "model": "guitar=htdemucs_6s, bass/drums/vocals=htdemucs",
        "supportedTargets": list(TARGET_LABELS.keys()),
    }


@app.post("/api/jobs")
async def create_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    mode: JobMode = Query("balanced"),
    target: Literal["guitar", "bass", "drums", "vocals"] = Query("guitar"),
) -> dict[str, str]:
    original_name = file.filename or ""
    extension = validate_upload_name(original_name)
    job_id = uuid4().hex
    job_dir = JOBS_ROOT / job_id
    input_dir = job_dir / "input"
    input_dir.mkdir(parents=True, exist_ok=True)
    input_path = input_dir / f"input.{extension}"

    size = await save_upload(file, input_path)
    if size == 0:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="请选择一个有效的音频文件。")

    jobs[job_id] = JobRecord(
        job_id=job_id,
        status="queued",
        progress=0,
        message="任务已进入队列。",
        mode=mode,
        target=target,
        bitrate=320 if mode == "quality" else 256,
        input_path=input_path,
        job_dir=job_dir,
        original_name=original_name,
        converted_filename=converted_output_filename(original_name) if mode == "convert" else None,
    )
    background_tasks.add_task(run_job, job_id)
    return {"jobId": job_id, "status": "queued"}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, object]:
    job = get_existing_job(job_id)
    payload: dict[str, object] = {
        "jobId": job.job_id,
        "status": job.status,
        "progress": job.progress,
        "message": job.message,
        "target": job.target,
        "targetLabel": TARGET_LABELS[job.target],
        "mode": job.mode,
        "format": "mp3",
        "bitrate": job.bitrate,
    }
    if job.error_code:
        payload["errorCode"] = job.error_code
    if job.status == "completed":
        if job.mode == "convert":
            filename = job.converted_filename or converted_output_filename(job.original_name)
            payload["converted"] = {
                "label": "MP3 文件",
                "url": f"/outputs/{job_id}/{filename}",
            }
        else:
            payload["isolated"] = {
                "label": f"{TARGET_LABELS[job.target]}轨道",
                "url": f"/outputs/{job_id}/{job.target}.mp3",
            }
            payload["backing"] = {
                "label": backing_label(job.target),
                "url": f"/outputs/{job_id}/no_{job.target}.mp3",
            }
    return payload


@app.get("/outputs/{job_id}/{filename}")
def output_file(job_id: str, filename: str) -> FileResponse:
    job = get_existing_job(job_id)
    allowed = {f"{target}.mp3" for target in TARGET_LABELS} | {f"no_{target}.mp3" for target in TARGET_LABELS}
    if job.converted_filename:
        allowed.add(job.converted_filename)
    if filename not in allowed:
        raise HTTPException(status_code=404, detail="结果文件不存在。")
    return download_result(job, filename)


def download_result(job: JobRecord, filename: str) -> FileResponse:
    if job.status != "completed":
        raise HTTPException(status_code=409, detail="任务尚未完成。")
    path = job.job_dir / "result" / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="结果文件不存在。")
    return FileResponse(
        path,
        media_type="audio/mpeg",
        filename=filename,
        headers={"Accept-Ranges": "bytes"},
    )


def backing_label(target: str) -> str:
    if target == "guitar":
        return "去吉他伴奏"
    return f"去{TARGET_LABELS[target]}伴奏"


def get_existing_job(job_id: str) -> JobRecord:
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在。")
    return job


def validate_upload_name(filename: str) -> str:
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="仅支持 mp3、wav、flac、m4a、aac、ogg、ncm 音频文件。")
    return extension


async def save_upload(file: UploadFile, destination: Path) -> int:
    size = 0
    with destination.open("wb") as output:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_SIZE:
                output.close()
                destination.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail="文件不能超过 100MB。")
            output.write(chunk)
    return size


def executable_exists(name: str) -> bool:
    return shutil.which(name) is not None


def python_module_exists(name: str) -> bool:
    completed = subprocess.run(
        [sys.executable, "-c", f"import {name}"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return completed.returncode == 0


def memory_gb() -> float:
    try:
        page_size = os.sysconf("SC_PAGE_SIZE")
        pages = os.sysconf("SC_PHYS_PAGES")
        return round(page_size * pages / 1024 / 1024 / 1024, 2)
    except (AttributeError, OSError, ValueError):
        return 0.0
