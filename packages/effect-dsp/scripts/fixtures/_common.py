from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.0.0"
GENERATOR_VERSION = "0.2.0"
DEFAULT_GENERATED_AT = "2026-03-18T00:00:00Z"
GENERATOR_SCRIPT = "scripts/generate-dspy-fixtures.py"
UPSTREAM_NAME = "dspy"
UPSTREAM_VERSION = "3.1.3"
PYTHON_VERSION = "3.11"


def metadata(generated_at: str) -> dict[str, Any]:
    return {
        "generatedAt": generated_at,
        "upstream": {
            "name": UPSTREAM_NAME,
            "version": UPSTREAM_VERSION,
        },
        "generator": {
            "script": GENERATOR_SCRIPT,
            "version": GENERATOR_VERSION,
        },
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
