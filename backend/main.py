from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from worker import JobRecord, jobs, run_job

SERVICE_NAME = "audio-separation-backend"
JOBS_ROOT = Path("/tmp/audio-jobs")
MAX_UPLOAD_SIZE = 100 * 1024 * 1024
ALLOWED_EXTENSIONS = {"mp3", "wav", "flac", "m4a", "aac", "ogg"}

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
)


@app.get("/health")
def health() -> dict[str, bool | str]:
    return {
        "ok": True,
        "service": SERVICE_NAME,
        "ffmpeg": executable_exists("ffmpeg"),
        "ffprobe": executable_exists("ffprobe"),
        "python": Path(sys.executable).exists(),
        "demucs": executable_exists("demucs"),
    }


@app.post("/api/jobs")
async def create_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    mode: Literal["fast", "quality"] = Query("fast"),
) -> dict[str, str]:
    extension = validate_upload_name(file.filename or "")
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
        input_path=input_path,
        job_dir=job_dir,
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
    }
    if job.status == "completed":
        payload["outputs"] = {
            "vocals": f"/api/jobs/{job_id}/download/vocals",
            "instrumental": f"/api/jobs/{job_id}/download/instrumental",
        }
    return payload


@app.get("/api/jobs/{job_id}/download/vocals")
def download_vocals(job_id: str) -> FileResponse:
    return download_result(job_id, "vocals.wav")


@app.get("/api/jobs/{job_id}/download/instrumental")
def download_instrumental(job_id: str) -> FileResponse:
    return download_result(job_id, "instrumental.wav")


def download_result(job_id: str, filename: str) -> FileResponse:
    job = get_existing_job(job_id)
    if job.status != "completed":
        raise HTTPException(status_code=409, detail="任务尚未完成。")
    path = job.job_dir / "result" / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="结果文件不存在。")
    return FileResponse(path, media_type="audio/wav", filename=filename)


def get_existing_job(job_id: str) -> JobRecord:
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在。")
    return job


def validate_upload_name(filename: str) -> str:
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="仅支持 mp3、wav、flac、m4a、aac、ogg 音频文件。")
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
