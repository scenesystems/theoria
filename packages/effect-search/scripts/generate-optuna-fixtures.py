#!/usr/bin/env -S uv run --locked
"""Generate / byte-check all Optuna reference fixtures with one pinned runtime."""

import argparse
import difflib
import hashlib
import json
import os
import platform
import sys
from pathlib import Path

if os.environ.get("PYTHONHASHSEED") != "0":
    os.execve(sys.executable, [sys.executable, *sys.argv], {**os.environ, "PYTHONHASHSEED": "0"})

# Use the same NumPy math path on orb and CI CPUs; SIMD dispatch changes last bits.
# GPSampler also uses PyTorch/MKL and SciPy/OpenBLAS. Fix dispatch and reduction
# order before importing any numerical library; never round reference outputs.
CPU_ENVIRONMENT = {"NPY_DISABLE_CPU_FEATURES": "AVX2,FMA3,AVX512F", "ATEN_CPU_CAPABILITY": "default",
                   "MKL_CBWR": "COMPATIBLE", "OPENBLAS_CORETYPE": "HASWELL", "OPENBLAS_NUM_THREADS": "1",
                   "MKL_NUM_THREADS": "1", "OMP_NUM_THREADS": "1"}
os.environ.update(CPU_ENVIRONMENT)
ENVIRONMENT = {"PYTHONHASHSEED": "0", **CPU_ENVIRONMENT}

import optuna

from fixtures import (
    gamma, split_trials, pruned_score, truncated_normal, categorical_parzen,
    continuous_kde, ei, motpe, study_replay, conditional, pruning, mixed_space,
    noise_bandwidth, multivariate_gaussian, constrained_tpe, advanced_samplers,
    mipro_kernel, trial_states, motpe_hssp, tpe_numeric,
)
from fixtures._common import DEFAULT_GENERATED_AT

ROOT = Path(__file__).resolve().parents[1] / "test/fixtures"
FAMILIES = [gamma, split_trials, pruned_score, truncated_normal, categorical_parzen,
            continuous_kde, ei, motpe, study_replay, conditional, pruning, mixed_space,
            noise_bandwidth, multivariate_gaussian, constrained_tpe, advanced_samplers,
            trial_states, motpe_hssp, tpe_numeric]


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
        "environment": ENVIRONMENT,
        "fixtures": sorted(entries, key=lambda entry: entry["name"]),
    }, sort_keys=True)
    kernel = mipro_kernel.generate()
    selection = kernel.pop("trajectorySelection")
    raw = render(kernel)
    outputs[ROOT / "optuna-mipro/categorical.json"] = raw
    outputs[ROOT / "optuna-mipro/manifest.json"] = render({
        "upstream": upstream, "environment": ENVIRONMENT, "trajectorySelection": selection, "fixtures": [{
            "id": "optuna-mipro-categorical", "file": "categorical.json",
            "evidence": "upstream-kernel", "sha256": hashlib.sha256(raw).hexdigest(),
            "generator": "scripts/fixtures/mipro_kernel.py",
            "description": "TPESampler ask/tell plus fixed-history joint categorical frequencies; includes FAIL.",
        }],
    })
    actual_paths = {path for directory in (ROOT / "optuna", ROOT / "optuna-mipro")
                    for path in directory.rglob("*") if path.is_file()}
    if actual_paths - outputs.keys():
        raise ValueError(f"Unowned fixture files: {actual_paths - outputs.keys()}")
    for path, raw in outputs.items():
        if check:
            if path.read_bytes() != raw:
                diff = "".join(difflib.unified_diff(path.read_text().splitlines(True), raw.decode().splitlines(True),
                                                  fromfile="committed", tofile="upstream"))
                raise ValueError(f"Optuna fixture differs: {path.relative_to(ROOT)}\n{diff}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
    print(f"{'Verified' if check else 'Generated'} {len(entries)} Optuna 4.9.0 fixtures and MIPRO kernel with hashes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    run(parser.parse_args().check)
