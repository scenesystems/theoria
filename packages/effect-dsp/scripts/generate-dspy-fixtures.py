#!/usr/bin/env -S uv run --locked
"""Offline upstream execution in the repository's pinned uv project; --check never writes."""

import argparse
import difflib
import logging
import os
import sys
from pathlib import Path

# String-set iteration is process-seeded, so this must precede interpreter startup.
# runpy verification retains the verifier's argv and therefore reexecutes it too.
if os.environ.get("PYTHONHASHSEED") != "0":
    os.execve(sys.executable, [sys.executable, *sys.argv], {**os.environ, "PYTHONHASHSEED": "0"})

# MIPRO uses NumPy-backed Optuna scoring; CPU dispatch can change tied selections.
os.environ["NPY_DISABLE_CPU_FEATURES"] = "AVX2,FMA3,AVX512F"

from fixtures import bootstrap_family, chat_adapter, evaluate_runtime, gepa, mipro_proposer, mipro_v2, numerics, predict_runtime
from fixtures._common import assert_runtime_version, document, render

ROOT = Path(__file__).resolve().parents[1] / "test/fixtures/dspy"
FAMILIES = [chat_adapter, predict_runtime, evaluate_runtime, bootstrap_family, mipro_v2, mipro_proposer, gepa, numerics]


def run(check=False, root=ROOT):
    runtime = assert_runtime_version()
    manifest_path = root / "manifest.json"
    entries = []
    for family in FAMILIES:
        for item in family.generate():
            entry, payload = document(item, family.__name__)
            path = root / entry["file"]
            if check:
                if not path.exists() or path.read_bytes() != payload:
                    committed = path.read_text().splitlines(True) if path.exists() else []
                    diff = "".join(difflib.unified_diff(committed, payload.decode().splitlines(True),
                                                      fromfile="committed", tofile="upstream"))
                    raise ValueError(f"Upstream execution differs: {entry['id']}\n{diff}")
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(payload)
            entries.append(entry)
    if len({entry["id"] for entry in entries}) != len(entries):
        raise ValueError("Duplicate fixture ID")
    expected_paths = {entry["file"] for entry in entries} | {"manifest.json"}
    actual_paths = {str(path.relative_to(root)) for path in root.rglob("*.json")}
    if actual_paths - expected_paths:
        raise ValueError(f"Unowned fixture files: {actual_paths - expected_paths}")
    manifest = render({"upstream": runtime, "environment": {"PYTHONHASHSEED": "0", "NPY_DISABLE_CPU_FEATURES": "AVX2,FMA3,AVX512F"},
                       "fixtures": sorted(entries, key=lambda e: e["id"])})
    if check:
        if manifest_path.read_bytes() != manifest:
            raise ValueError("Manifest differs from pinned runtime / fixture hashes")
    else:
        manifest_path.write_bytes(manifest)
    print(f"{'Verified' if check else 'Generated'} {len(entries)} pinned upstream fixtures (zero local regressions)")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--output-directory", type=Path, default=ROOT)
    args = parser.parse_args()
    logging.disable(logging.CRITICAL)
    run(args.check, args.output_directory)


if __name__ == "__main__":
    main()
