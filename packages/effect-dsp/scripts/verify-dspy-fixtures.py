#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["dspy==3.4.0", "gepa==0.1.4", "optuna==4.9.0"]
# ///
"""Re-execute the pinned reference; verify every payload hash without writing."""

import logging
import runpy
from pathlib import Path

logging.disable(logging.CRITICAL)
generator = runpy.run_path(str(Path(__file__).with_name("generate-dspy-fixtures.py")))
generator["run"](check=True)
