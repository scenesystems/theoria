#!/usr/bin/env -S uv run --locked
"""Re-execute every Optuna reference; compare exact payload and manifest bytes."""

import runpy
from pathlib import Path

generator = runpy.run_path(str(Path(__file__).with_name("generate-optuna-fixtures.py")))
generator["run"](check=True)
