#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "scipy>=1.15,<2",
#   "numpy>=1.26,<2",
# ]
# [tool.uv]
# exclude-newer = "2026-03-23T00:00:00Z"
# ///
"""Generate deterministic SciPy/NumPy-aligned fixture artifacts for effect-math tests.

All expected values are computed from live SciPy/NumPy internals.
The payloads are committed to the repository so parity suites never
derive expected values from the implementation under test.

Requirements: uv (https://docs.astral.sh/uv/)
Usage:        uv run scripts/generate-scipy-fixtures.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from fixtures._common import DEFAULT_GENERATED_AT, GENERATOR_VERSION, SCHEMA_VERSION, write_json
from fixtures import (
    numeric,
    linalg,
    geometry,
    probability,
    statistics,
    special,
)

FAMILIES = [
    numeric,
    linalg,
    geometry,
    probability,
    statistics,
    special,
]

FIXTURE_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "test" / "fixtures" / "scipy"


def generate_manifest(
    all_fixtures: list[dict[str, Any]], generated_at: str
) -> dict[str, Any]:
    import importlib.metadata
    import platform

    scipy_version = importlib.metadata.version("scipy")
    numpy_version = importlib.metadata.version("numpy")

    entries = [
        {"name": fixture["fixture"], "file": fixture["file"]}
        for fixture in all_fixtures
    ]

    return {
        "schemaVersion": SCHEMA_VERSION,
        "generator": {
            "script": "scripts/generate-scipy-fixtures.py",
            "generatorVersion": GENERATOR_VERSION,
            "upstream": "scipy",
            "upstreamVersion": scipy_version,
            "numpyVersion": numpy_version,
            "pythonVersion": platform.python_version(),
            "generatedAt": generated_at,
        },
        "fixtures": sorted(entries, key=lambda e: e["name"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate SciPy/NumPy fixture artifacts")
    parser.add_argument(
        "--generated-at",
        default=DEFAULT_GENERATED_AT,
        help="ISO-8601 timestamp for provenance",
    )
    args = parser.parse_args()

    FIXTURE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    all_fixtures: list[dict[str, Any]] = []
    for family in FAMILIES:
        fixtures = family.generate(args.generated_at)
        all_fixtures.extend(fixtures)

        for fixture in fixtures:
            fixture_path = FIXTURE_OUTPUT_DIR / fixture["file"]
            fixture_path.parent.mkdir(parents=True, exist_ok=True)

            document = {
                "fixture": fixture["fixture"],
                "metadata": fixture["metadata"],
                "payload": fixture["payload"],
            }
            write_json(fixture_path, document)
            print(f"  ✓ {fixture['fixture']} → {fixture_path.relative_to(FIXTURE_OUTPUT_DIR)}")

    manifest = generate_manifest(all_fixtures, args.generated_at)
    manifest_path = FIXTURE_OUTPUT_DIR / "manifest.json"
    write_json(manifest_path, manifest)
    print(f"\n  ✓ manifest → {manifest_path.relative_to(FIXTURE_OUTPUT_DIR)}")

    total_cases = sum(
        len(f["payload"].get("cases", []))
        for f in all_fixtures
    )
    print(f"\nGenerated {len(all_fixtures)} fixture files with {total_cases} total cases.")


if __name__ == "__main__":
    main()
