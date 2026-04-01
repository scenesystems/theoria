#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "optuna==4.3.0",
#   "numpy>=1.26,<2",
# ]
# [tool.uv]
# exclude-newer = "2026-03-15T00:00:00Z"
# ///
"""Generate deterministic Optuna-aligned fixture artifacts for effect-search tests.

All expected values should be computed from live Optuna internals.
The payloads are committed to the repository so parity suites never
derive expected values from the implementation under test.

Requirements: uv (https://docs.astral.sh/uv/)
Usage:        uv run scripts/generate-optuna-fixtures.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Family imports — each module exports generate(generated_at) -> list[dict]
from fixtures._common import GENERATOR_VERSION, SCHEMA_VERSION, write_json
from fixtures import (
    gamma,
    split_trials,
    pruned_score,
    truncated_normal,
    categorical_parzen,
    continuous_kde,
    ei,
    motpe,
    study_replay,
    conditional,
    pruning,
    mixed_space,
    noise_bandwidth,
    multivariate_gaussian,
    constrained_tpe,
    advanced_samplers,
)

FAMILIES = [
    gamma,
    split_trials,
    pruned_score,
    truncated_normal,
    categorical_parzen,
    continuous_kde,
    ei,
    motpe,
    study_replay,
    conditional,
    pruning,
    mixed_space,
    noise_bandwidth,
    multivariate_gaussian,
    constrained_tpe,
    advanced_samplers,
]

DEFAULT_GENERATED_AT = "2026-03-15T00:00:00Z"


def collect_fixtures(generated_at: str) -> list[dict[str, Any]]:
    """Collect all fixture documents from every family module."""
    docs: list[dict[str, Any]] = []
    for family in FAMILIES:
        docs.extend(family.generate(generated_at))
    return docs


def fixture_file_path(doc: dict[str, Any]) -> str:
    """Resolve the output path for a fixture document.

    Uses the explicit 'file' key if present, otherwise falls back to
    '{fixture-name}.json'.
    """
    if "file" in doc:
        return doc["file"]
    return f"{doc['fixture']}.json"


def build_manifest(generated_at: str, fixture_docs: list[dict[str, Any]]) -> dict[str, Any]:
    fixtures = [
        {
            "name": doc["fixture"],
            "file": fixture_file_path(doc),
        }
        for doc in fixture_docs
    ]

    return {
        "schemaVersion": SCHEMA_VERSION,
        "generator": {
            "script": "scripts/generate-optuna-fixtures.py",
            "generatorVersion": GENERATOR_VERSION,
            "upstream": "optuna",
            "upstreamVersion": "4.3.0",
            "pythonVersion": "3.11",
            "generatedAt": generated_at,
        },
        "fixtures": sorted(fixtures, key=lambda entry: entry["name"]),
    }


def run(output_dir: Path, generated_at: str) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    fixture_docs = collect_fixtures(generated_at)

    for doc in fixture_docs:
        # Strip the 'file' key before writing — it's routing metadata, not fixture content
        path = output_dir / fixture_file_path(doc)
        path.parent.mkdir(parents=True, exist_ok=True)
        output_doc = {k: v for k, v in doc.items() if k != "file"}
        write_json(path, output_doc)

    manifest = build_manifest(generated_at, fixture_docs)
    write_json(output_dir / "manifest.json", manifest)

    print(f"Generated {len(fixture_docs)} fixtures in {output_dir}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate deterministic Optuna fixture files")
    parser.add_argument(
        "--output-dir",
        default="test/fixtures/optuna",
        help="Fixture output directory relative to effect-search/",
    )
    parser.add_argument(
        "--generated-at",
        default=DEFAULT_GENERATED_AT,
        help="Version-stamped generation timestamp",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run(Path(args.output_dir), args.generated_at)


if __name__ == "__main__":
    main()
