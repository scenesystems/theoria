#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "dspy-ai==3.1.3",
# ]
# [tool.uv]
# exclude-newer = "2026-03-18T00:00:00Z"
# ///
"""Generate deterministic DSPy-aligned fixture artifacts for effect-dsp tests.

Requirements: uv (https://docs.astral.sh/uv/)
Usage:        uv run scripts/generate-dspy-fixtures.py
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import dspy

from fixtures import bootstrap_family, chat_adapter, evaluate_runtime, gepa, mipro_v2, multi_chain_comparison, predict_runtime, program_of_thought
from fixtures._common import (
    DEFAULT_GENERATED_AT,
    GENERATOR_SCRIPT,
    GENERATOR_VERSION,
    PYTHON_VERSION,
    SCHEMA_VERSION,
    UPSTREAM_NAME,
    UPSTREAM_VERSION,
    write_json,
)

FAMILIES = [chat_adapter, predict_runtime, program_of_thought, multi_chain_comparison, evaluate_runtime, bootstrap_family, mipro_v2, gepa]


def assert_runtime_version() -> None:
    runtime_version = getattr(dspy, "__version__", "unknown")
    if runtime_version != UPSTREAM_VERSION:
        raise RuntimeError(
            "dspy runtime drift detected: "
            f"expected {UPSTREAM_VERSION}, got {runtime_version}. "
            "Run `bun run fixtures:lock` and commit updated lockfiles if upgrading DSPy."
        )


def collect_fixtures(generated_at: str) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    for family in FAMILIES:
        docs.extend(family.generate(generated_at))
    return docs


def fixture_file_path(doc: dict[str, Any]) -> str:
    if "file" in doc:
        return str(doc["file"])

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
            "script": GENERATOR_SCRIPT,
            "generatorVersion": GENERATOR_VERSION,
            "upstream": UPSTREAM_NAME,
            "upstreamVersion": UPSTREAM_VERSION,
            "pythonVersion": PYTHON_VERSION,
            "generatedAt": generated_at,
        },
        "fixtures": sorted(fixtures, key=lambda entry: entry["name"]),
    }


def run(output_dir: Path, generated_at: str) -> None:
    assert_runtime_version()

    output_dir.mkdir(parents=True, exist_ok=True)

    fixture_docs = collect_fixtures(generated_at)

    for doc in fixture_docs:
        path = output_dir / fixture_file_path(doc)
        output_doc = {k: v for k, v in doc.items() if k != "file"}
        write_json(path, output_doc)

    manifest = build_manifest(generated_at, fixture_docs)
    write_json(output_dir / "manifest.json", manifest)

    print(f"Generated {len(fixture_docs)} fixtures in {output_dir}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate deterministic DSPy fixture files")
    parser.add_argument(
        "--output-dir",
        default="test/fixtures/dspy",
        help="Fixture output directory relative to effect-dsp/",
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
