"""Shared helpers for effect-math fixture family generators."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

GENERATOR_VERSION = "1.0.0"
SCHEMA_VERSION = "1.0.0"
DEFAULT_GENERATED_AT = "2026-03-23T00:00:00Z"

UPSTREAM_NAME = "scipy"
UPSTREAM_VERSION = "1.15.2"


def metadata(generated_at: str) -> dict[str, Any]:
    """Standard metadata block for every fixture document."""
    return {
        "generatedAt": generated_at,
        "upstream": {
            "name": UPSTREAM_NAME,
            "version": UPSTREAM_VERSION,
        },
        "generator": {
            "script": "scripts/generate-scipy-fixtures.py",
            "version": GENERATOR_VERSION,
        },
    }


def write_json(path: Path, value: dict[str, Any]) -> None:
    """Write a fixture document as pretty-printed JSON with trailing newline."""
    rendered = json.dumps(value, indent=2, sort_keys=True)
    path.write_text(f"{rendered}\n", encoding="utf-8")
