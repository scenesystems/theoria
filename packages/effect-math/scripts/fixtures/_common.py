"""Shared helpers for effect-math fixture family generators."""

from __future__ import annotations

import importlib.metadata
import platform
from typing import Any

GENERATOR_VERSION = "1.0.0"
SCHEMA_VERSION = "1.0.0"

UPSTREAM_NAME = "scipy"
UPSTREAM_VERSION = importlib.metadata.version(UPSTREAM_NAME)


def generator_metadata(generated_at: str) -> dict[str, Any]:
    """Attest the versions actually used by this reference process."""
    return {
        "script": "scripts/generate-scipy-fixtures.py",
        "generatorVersion": GENERATOR_VERSION,
        "upstream": UPSTREAM_NAME,
        "upstreamVersion": UPSTREAM_VERSION,
        "numpyVersion": importlib.metadata.version("numpy"),
        "pythonVersion": platform.python_version(),
        "generatedAt": generated_at,
    }


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
