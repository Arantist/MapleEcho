from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

from worker import JobRecord, jobs, run_job


class WorkerTest(unittest.TestCase):
    def setUp(self) -> None:
        jobs.clear()

    def tearDown(self) -> None:
        jobs.clear()

    def test_ncm_convert_writes_single_mp3_without_demucs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_path = root / "input" / "demo.ncm"
            input_path.parent.mkdir(parents=True)
            input_path.write_bytes(b"ncm")
            job = make_job(root, input_path, "convert", "demo.ncm")
            jobs[job.job_id] = job

            def fake_convert_ncm_to_mp3(source: Path, work_dir: Path, output_path: Path) -> Path:
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_bytes(b"mp3")
                return output_path

            with patch("worker.convert_ncm_to_mp3", fake_convert_ncm_to_mp3), patch("worker.run_demucs") as demucs:
                run_job(job.job_id)

            self.assertEqual(job.status, "completed")
            self.assertEqual(job.message, "转换完成。")
            self.assertEqual(job.converted_filename, "demo-converted.mp3")
            self.assertTrue((root / "result" / "demo-converted.mp3").exists())
            self.assertFalse(input_path.exists())
            demucs.assert_not_called()

    def test_ncm_separation_converts_before_existing_demucs_flow(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_path = root / "input" / "demo.ncm"
            input_path.parent.mkdir(parents=True)
            input_path.write_bytes(b"ncm")
            decoded_path = root / "converted" / "demo.flac"
            job = make_job(root, input_path, "balanced", "demo.ncm")
            jobs[job.job_id] = job

            def fake_convert_ncm_to_standard_audio(source: Path, work_dir: Path) -> Path:
                decoded_path.parent.mkdir(parents=True, exist_ok=True)
                decoded_path.write_bytes(b"flac")
                return decoded_path

            with patch("worker.convert_ncm_to_standard_audio", fake_convert_ncm_to_standard_audio), patch("worker.run_demucs") as demucs:
                run_job(job.job_id)

            self.assertEqual(job.status, "completed")
            demucs.assert_called_once()
            self.assertEqual(demucs.call_args.args[0], decoded_path)
            self.assertEqual(demucs.call_args.args[2], "balanced")
            self.assertFalse(input_path.exists())
            self.assertFalse((root / "converted").exists())

    def test_regular_audio_uses_existing_demucs_flow_directly(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_path = root / "input" / "demo.mp3"
            input_path.parent.mkdir(parents=True)
            input_path.write_bytes(b"mp3")
            job = make_job(root, input_path, "quality", "demo.mp3")
            jobs[job.job_id] = job

            with patch("worker.convert_ncm_to_standard_audio") as converter, patch("worker.run_demucs") as demucs:
                run_job(job.job_id)

            self.assertEqual(job.status, "completed")
            converter.assert_not_called()
            demucs.assert_called_once()
            self.assertEqual(demucs.call_args.args[0], input_path)
            self.assertEqual(demucs.call_args.args[2], "quality")


def make_job(root: Path, input_path: Path, mode, original_name: str) -> JobRecord:
    return JobRecord(
        job_id="job-1",
        status="queued",
        progress=0,
        message="任务已进入队列。",
        mode=mode,
        target="guitar",
        bitrate=320 if mode == "quality" else 256,
        input_path=input_path,
        job_dir=root,
        original_name=original_name,
    )


if __name__ == "__main__":
    unittest.main()
