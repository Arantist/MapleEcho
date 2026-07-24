from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ncm_converter import (
    INVALID_NCM_FILE,
    NCM_CONVERTER_UNAVAILABLE,
    NCM_CONVERSION_FAILED,
    NCM_CONVERSION_TIMEOUT,
    NCM_OUTPUT_INVALID,
    NCM_MAGIC,
    NcmConversionError,
    convert_ncm_to_mp3,
    convert_ncm_to_standard_audio,
)


class Completed:
    def __init__(self, returncode: int = 0, stdout: str = "audio\n", stderr: str = "") -> None:
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


class NcmConverterTest(unittest.TestCase):
    def test_reports_missing_ncmdump_dependency(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_path = write_ncm(root / "song.ncm")

            with patch("ncm_converter.importlib.util.find_spec", return_value=None):
                with self.assertRaises(NcmConversionError) as raised:
                    convert_ncm_to_standard_audio(input_path, root / "work")

            self.assertEqual(raised.exception.code, NCM_CONVERTER_UNAVAILABLE)

    def test_rejects_invalid_ncm_header(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_path = root / "broken.ncm"
            input_path.write_bytes(b"not-ncm")

            with self.assertRaises(NcmConversionError) as raised:
                convert_ncm_to_standard_audio(input_path, root / "work")

            self.assertEqual(raised.exception.code, INVALID_NCM_FILE)

    def test_maps_ncmdump_timeout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_path = write_ncm(root / "song.ncm")

            def fake_run(command, **kwargs):
                raise subprocess.TimeoutExpired(command, timeout=1)

            with patch("ncm_converter.subprocess.run", fake_run):
                with self.assertRaises(NcmConversionError) as raised:
                    convert_ncm_to_standard_audio(input_path, root / "work")

            self.assertEqual(raised.exception.code, NCM_CONVERSION_TIMEOUT)

    def test_maps_ncmdump_failure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_path = write_ncm(root / "song.ncm")

            with patch("ncm_converter.subprocess.run", return_value=Completed(returncode=1, stderr="boom")):
                with self.assertRaises(NcmConversionError) as raised:
                    convert_ncm_to_standard_audio(input_path, root / "work")

            self.assertEqual(raised.exception.code, NCM_CONVERSION_FAILED)

    def test_maps_missing_decoded_output_to_conversion_failure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_path = write_ncm(root / "song.ncm")

            with patch("ncm_converter.subprocess.run", return_value=Completed()):
                with self.assertRaises(NcmConversionError) as raised:
                    convert_ncm_to_standard_audio(input_path, root / "work")

            self.assertEqual(raised.exception.code, NCM_CONVERSION_FAILED)

    def test_maps_invalid_decoded_audio(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_path = write_ncm(root / "song.ncm")

            def fake_run(command, **kwargs):
                if "ncmdump.app" in command:
                    (root / "work").mkdir(exist_ok=True)
                    (root / "work" / "song.mp3").write_bytes(b"decoded")
                    return Completed()
                return Completed(returncode=1, stderr="invalid audio")

            with patch("ncm_converter.subprocess.run", fake_run):
                with self.assertRaises(NcmConversionError) as raised:
                    convert_ncm_to_standard_audio(input_path, root / "work")

            self.assertEqual(raised.exception.code, NCM_OUTPUT_INVALID)

    def test_reuses_decoded_mp3_without_ffmpeg_transcode(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_path = write_ncm(root / "song.ncm")
            output_path = root / "result" / "song-converted.mp3"
            calls: list[list[str]] = []

            def fake_run(command, **kwargs):
                calls.append(command)
                if "ncmdump.app" in command:
                    (root / "work").mkdir(exist_ok=True)
                    (root / "work" / "song.mp3").write_bytes(b"decoded mp3")
                return Completed()

            with patch("ncm_converter.subprocess.run", fake_run):
                result = convert_ncm_to_mp3(input_path, root / "work", output_path)

            self.assertEqual(result, output_path)
            self.assertEqual(output_path.read_bytes(), b"decoded mp3")
            self.assertFalse(any(command and command[0] == "ffmpeg" for command in calls))

    def test_transcodes_decoded_flac_to_mp3(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            input_path = write_ncm(root / "song.ncm")
            output_path = root / "result" / "song-converted.mp3"
            calls: list[list[str]] = []

            def fake_run(command, **kwargs):
                calls.append(command)
                if "ncmdump.app" in command:
                    (root / "work").mkdir(exist_ok=True)
                    (root / "work" / "song.flac").write_bytes(b"decoded flac")
                    return Completed()
                if command and command[0] == "ffmpeg":
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    output_path.write_bytes(b"converted mp3")
                    return Completed()
                return Completed()

            with patch("ncm_converter.subprocess.run", fake_run):
                result = convert_ncm_to_mp3(input_path, root / "work", output_path)

            self.assertEqual(result, output_path)
            self.assertEqual(output_path.read_bytes(), b"converted mp3")
            self.assertTrue(any(command and command[0] == "ffmpeg" for command in calls))


def write_ncm(path: Path) -> Path:
    path.write_bytes(NCM_MAGIC + b"\0" * 16)
    return path


if __name__ == "__main__":
    unittest.main()
