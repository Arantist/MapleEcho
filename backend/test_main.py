from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

from main import health


class HealthTest(unittest.TestCase):
    def test_health_is_ready_when_all_runtime_dependencies_exist(self) -> None:
        with (
            patch("main.executable_exists", return_value=True),
            patch("main.python_module_exists", return_value=True),
        ):
            result = health()

        self.assertTrue(result["ok"])
        self.assertTrue(result["ncmdump"])

    def test_health_fails_when_ncmdump_is_missing(self) -> None:
        def module_exists(name: str) -> bool:
            return name != "ncmdump"

        with (
            patch("main.executable_exists", return_value=True),
            patch("main.python_module_exists", side_effect=module_exists),
        ):
            result = health()

        self.assertFalse(result["ok"])
        self.assertFalse(result["ncmdump"])


if __name__ == "__main__":
    unittest.main()
