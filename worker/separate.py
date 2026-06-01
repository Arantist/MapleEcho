#!/usr/bin/env python3
import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


MODEL_BY_MODE = {
    "speed": "htdemucs_6s",
    "quality": "htdemucs_6s",
}

SHIFTS_BY_MODE = {
    "speed": 1,
    "quality": 2,
}


def main() -> int:
    args = parse_args()
    job_file = Path(args.job_file)
    worker_log = Path(args.worker_log)
    worker_log.parent.mkdir(parents=True, exist_ok=True)
    result_dir = Path(args.result_dir)
    temp_output_dir = Path(args.temp_output_dir)
    result_dir.mkdir(parents=True, exist_ok=True)
    temp_output_dir.mkdir(parents=True, exist_ok=True)

    model = MODEL_BY_MODE[args.mode]
    warning = None
    devices = preferred_devices(worker_log)

    update_job(job_file, status="running", progress=30)
    for index, device in enumerate(devices):
        update_job(job_file, status="running", progress=30, device=device)
        code = run_demucs(
            input_file=Path(args.input),
            temp_output_dir=temp_output_dir,
            model=model,
            device=device,
            shifts=SHIFTS_BY_MODE[args.mode],
            worker_log=worker_log,
        )
        if code == 0:
            stems = {
                "vocals": find_named_file(temp_output_dir, "vocals.mp3"),
                "drums": find_named_file(temp_output_dir, "drums.mp3"),
                "bass": find_named_file(temp_output_dir, "bass.mp3"),
                "other": find_named_file(temp_output_dir, "other.mp3"),
                "guitar": find_named_file(temp_output_dir, "guitar.mp3"),
                "piano": find_named_file(temp_output_dir, "piano.mp3"),
            }
            missing_stems = [name for name, path in stems.items() if path is None]
            if not missing_stems:
                update_job(job_file, status="running", progress=90, device=device, warning=warning)
                shutil.copy2(stems["vocals"], result_dir / "vocals.mp3")
                shutil.copy2(stems["guitar"], result_dir / "guitar.mp3")
                instrumental_code = run_ffmpeg_mix(
                    input_files=[stems["drums"], stems["bass"], stems["other"], stems["guitar"], stems["piano"]],
                    output_file=result_dir / "instrumental.mp3",
                    worker_log=worker_log,
                )
                no_guitar_code = run_ffmpeg_mix(
                    input_files=[stems["vocals"], stems["drums"], stems["bass"], stems["other"], stems["piano"]],
                    output_file=result_dir / "no_guitar.mp3",
                    worker_log=worker_log,
                )
                if instrumental_code != 0 or no_guitar_code != 0:
                    append_log(worker_log, "ffmpeg failed while creating instrumental.mp3 or no_guitar.mp3.")
                    continue
                update_job(
                    job_file,
                    status="completed",
                    progress=100,
                    device=device,
                    warning=warning,
                    files={
                        "vocals": f"/api/jobs/{args.job_id}/files/vocals",
                        "instrumental": f"/api/jobs/{args.job_id}/files/instrumental",
                        "guitar": f"/api/jobs/{args.job_id}/files/guitar",
                        "no_guitar": f"/api/jobs/{args.job_id}/files/no_guitar",
                    },
                )
                return 0
            append_log(worker_log, f"Demucs finished, but expected stems were not found: {', '.join(missing_stems)}.")
        if device == "mps" and index < len(devices) - 1:
            warning = "MPS 处理失败，已自动改用 CPU 重试。"
            update_job(job_file, warning=warning)
            append_log(worker_log, warning)

    update_job(
        job_file,
        status="failed",
        progress=100,
        error="分离失败。请查看 logs/worker.log。",
        warning=warning,
    )
    return 1


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--result-dir", required=True)
    parser.add_argument("--temp-output-dir", required=True)
    parser.add_argument("--mode", required=True, choices=MODEL_BY_MODE.keys())
    parser.add_argument("--job-file", required=True)
    parser.add_argument("--worker-log", required=True)
    return parser.parse_args()


def preferred_devices(worker_log: Path):
    try:
        import torch

        if torch.backends.mps.is_available():
            return ["mps", "cpu"]
        append_log(worker_log, "MPS is not available. Using CPU.")
    except Exception as exc:
        append_log(worker_log, f"Could not inspect torch MPS support: {exc}. Using CPU.")
    return ["cpu"]


def run_demucs(input_file: Path, temp_output_dir: Path, model: str, device: str, shifts: int, worker_log: Path) -> int:
    command = [
        sys.executable,
        "-m",
        "demucs",
        "-n",
        model,
        "--shifts",
        str(shifts),
        "--mp3",
        "--mp3-bitrate",
        "320",
        "-d",
        device,
        "-o",
        str(temp_output_dir),
        str(input_file),
    ]
    append_log(worker_log, f"Running: {' '.join(command)}")
    with worker_log.open("a", encoding="utf-8") as log:
        process = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
    return process.returncode


def run_ffmpeg_mix(input_files, output_file: Path, worker_log: Path) -> int:
    command = ["ffmpeg", "-y"]
    for input_file in input_files:
        command.extend(["-i", str(input_file)])
    filter_graph = f"amix=inputs={len(input_files)}:duration=longest:normalize=0,alimiter=limit=0.98"
    command.extend([
        "-filter_complex",
        filter_graph,
        "-c:a",
        "libmp3lame",
        "-b:a",
        "320k",
        str(output_file),
    ])
    append_log(worker_log, f"Running: {' '.join(command)}")
    with worker_log.open("a", encoding="utf-8") as log:
        process = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
    return process.returncode


def find_named_file(root: Path, name: str):
    matches = list(root.rglob(name))
    return matches[0] if matches else None


def update_job(job_file: Path, **patch):
    try:
        job = json.loads(job_file.read_text(encoding="utf-8"))
    except FileNotFoundError:
        job = {}
    job.update({key: value for key, value in patch.items() if value is not None})
    job["updatedAt"] = datetime.now(timezone.utc).isoformat()
    job_file.write_text(json.dumps(job, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def append_log(worker_log: Path, message: str):
    worker_log.parent.mkdir(parents=True, exist_ok=True)
    with worker_log.open("a", encoding="utf-8") as log:
        log.write(message + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
