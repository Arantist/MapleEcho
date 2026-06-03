from __future__ import annotations

import tempfile
import unittest
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

from demucs_runner import run_demucs


class DemucsRunnerTest(unittest.TestCase):
    def test_guitar_balanced_uses_two_stems_mp3_and_leaves_two_results(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_path = root / "song.mp3"
            input_path.write_bytes(b"audio")
            job_dir = root / "job"
            calls: list[list[str]] = []

            def fake_run(command, **kwargs):
                calls.append(command)
                output_dir = job_dir / "output" / "htdemucs_6s" / "song"
                output_dir.mkdir(parents=True, exist_ok=True)
                (output_dir / "guitar.mp3").write_bytes(b"guitar")
                (output_dir / "no_guitar.mp3").write_bytes(b"backing")

                class Completed:
                    returncode = 0
                    stdout = ""
                    stderr = ""

                return Completed()

            with patch("demucs_runner.subprocess.run", fake_run):
                run_demucs(input_path, job_dir, "balanced", "guitar", progress=lambda *_: None)

            command = calls[0]
            self.assertIn("htdemucs_6s", command)
            self.assertIn("--two-stems=guitar", command)
            self.assertIn("--mp3", command)
            self.assertIn("--mp3-bitrate", command)
            self.assertIn("256", command)
            self.assertTrue((job_dir / "result" / "guitar.mp3").exists())
            self.assertTrue((job_dir / "result" / "no_guitar.mp3").exists())
            self.assertFalse((job_dir / "output").exists())
            self.assertFalse(input_path.exists())


if __name__ == "__main__":
    unittest.main()
