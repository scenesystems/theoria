#!/usr/bin/env -S uv run --locked
"""Evaluate one SciPy/NumPy reference family through a JSON stdin/stdout protocol.

Reference values use live SciPy/NumPy and documented analytic formulas.
The Effect entrypoint owns family discovery, process lifetime, validation,
fixture files, and manifest construction. This process only evaluates the
requested Python family and returns its reference data and provenance.

Requirements: uv (https://docs.astral.sh/uv/)
Entry point:  bun run fixtures:generate
"""

from __future__ import annotations

import importlib
import json
import sys

from fixtures._common import generator_metadata


def main() -> None:
    request = json.load(sys.stdin)
    family = importlib.import_module(f"fixtures.{request['family']}")
    json.dump(
        {
            "generator": generator_metadata(request["generatedAt"]),
            "fixtures": family.generate(request["generatedAt"]),
        },
        sys.stdout,
        allow_nan=False,
    )
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
