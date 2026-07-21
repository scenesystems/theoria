#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "blake3==1.0.8",
# ]
# [tool.uv]
# exclude-newer = "2026-03-25T00:00:00Z"
# ///
"""Generate deterministic Python runtime parity fixtures for @scenesystems/digest.

Usage:
  uv run packages/digest/scripts/parity/python/generate.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Literal

import blake3

GeneratedAt = Literal["2026-03-25T00:00:00Z"]

PARITY_CASES = (
    ("blake3:empty", "blake3-256", ""),
    ("sha256:abc", "sha256", "abc"),
)


def compute_digest(algorithm: str, input_utf8: str) -> str:
    payload = input_utf8.encode("utf-8")
    if algorithm == "sha256":
        return hashlib.sha256(payload).hexdigest()
    if algorithm == "blake3-256":
        return blake3.blake3(payload).hexdigest()
    raise ValueError(f"Unsupported digest algorithm: {algorithm}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Python parity fixture")
    parser.add_argument(
        "--generated-at",
        default="2026-03-25T00:00:00Z",
        choices=["2026-03-25T00:00:00Z"],
        help="Pinned generation timestamp for deterministic fixture output",
    )
    args = parser.parse_args()

    package_root = Path(__file__).resolve().parents[3]
    output_path = package_root / "test" / "fixtures" / "parity" / "generated" / "python.json"

    cases = [
        {
            "id": case_id,
            "algorithm": algorithm,
            "inputUtf8": input_utf8,
            "expectedHex": compute_digest(algorithm, input_utf8),
        }
        for case_id, algorithm, input_utf8 in PARITY_CASES
    ]

    document = {
        "runtime": "python",
        "generatedAt": args.generated_at,
        "cases": cases,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(f"{json.dumps(document, indent=2)}\n", encoding="utf-8")


if __name__ == "__main__":
    main()
