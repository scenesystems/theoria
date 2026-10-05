#!/usr/bin/env -S uv run --locked
"""Re-execute the pinned reference; verify every payload hash without writing."""

import logging
import runpy
from pathlib import Path

logging.disable(logging.CRITICAL)
generator = runpy.run_path(str(Path(__file__).with_name("generate-dspy-fixtures.py")))
generator["run"](check=True)
