#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["optuna==4.9.0", "numpy>=1.26,<2"]
# ///
"""Generate / byte-check all Optuna reference fixtures with one pinned runtime."""

import argparse
import hashlib
import json
import os
import platform
import runpy
from pathlib import Path

# Use the same NumPy math path on orb and CI CPUs; SIMD dispatch changes last bits.
os.environ["NPY_DISABLE_CPU_FEATURES"] = "AVX2,FMA3,AVX512F"

import optuna

from fixtures import (
    gamma, split_trials, pruned_score, truncated_normal, categorical_parzen,
    continuous_kde, ei, motpe, study_replay, conditional, pruning, mixed_space,
    noise_bandwidth, multivariate_gaussian, constrained_tpe, advanced_samplers,
    mipro_kernel,
)
from fixtures._common import DEFAULT_GENERATED_AT

ROOT = Path(__file__).resolve().parents[1] / "test/fixtures"
FAMILIES = [gamma, split_trials, pruned_score, truncated_normal, categorical_parzen,
            continuous_kde, ei, motpe, study_replay, conditional, pruning, mixed_space,
            noise_bandwidth, multivariate_gaussian, constrained_tpe, advanced_samplers]


def render(value, *, sort_keys=False):
    return (json.dumps(value, indent=2, sort_keys=sort_keys, allow_nan=False) + "\n").encode()


def run(check=False):
    assert optuna.__version__ == "4.9.0"
    upstream = {"optuna": optuna.__version__, "python": platform.python_version(),
                "platform": f"{platform.system()}-{platform.machine()}"}
    outputs, entries = {}, []
    for family in FAMILIES:
        for doc in family.generate(DEFAULT_GENERATED_AT):
            name = doc.get("file", f"{doc['fixture']}.json")
            raw = render({k: v for k, v in doc.items() if k != "file"}, sort_keys=True)
            outputs[ROOT / "optuna" / name] = raw
            entries.append({"name": doc["fixture"], "file": name,
                            "sha256": hashlib.sha256(raw).hexdigest()})
    outputs[ROOT / "optuna/manifest.json"] = render({
        "upstream": upstream, "generator": "scripts/generate-optuna-fixtures.py",
        "fixtures": sorted(entries, key=lambda entry: entry["name"]),
    }, sort_keys=True)
    raw = render(mipro_kernel.generate())
    outputs[ROOT / "optuna-mipro/categorical.json"] = raw
    outputs[ROOT / "optuna-mipro/manifest.json"] = render({
        "upstream": upstream, "fixtures": [{
            "id": "optuna-mipro-categorical-001", "file": "categorical.json",
            "evidence": "upstream-kernel", "sha256": hashlib.sha256(raw).hexdigest(),
            "generator": "scripts/fixtures/mipro_kernel.py",
            "description": "TPESampler ask/tell plus fixed-history joint categorical frequencies; includes FAIL.",
        }],
    })
    for path, raw in outputs.items():
        if check:
            if path.read_bytes() != raw:
                raise ValueError(f"Optuna fixture differs: {path.relative_to(ROOT)}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
    if check:
        verifier = runpy.run_path(str(Path(__file__).with_name("verify-optuna-fixtures.py")))
        verifier["main"]()
    print(f"{'Verified' if check else 'Generated'} {len(entries)} Optuna 4.9.0 fixtures and MIPRO kernel with hashes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    run(parser.parse_args().check)
