#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["optuna==4.9.0"]
# ///
"""Generate / check the MIPRO categorical TPE kernel; legacy 4.3 corpus is separate."""

import argparse
import hashlib
import json
import platform
from pathlib import Path

import optuna

from fixtures.mipro_kernel import generate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    assert optuna.__version__ == "4.9.0"
    root = Path(__file__).resolve().parents[1] / "test/fixtures/optuna-mipro"
    raw = (json.dumps(generate(), indent=2) + "\n").encode()
    manifest = (json.dumps({"upstream": {"optuna": optuna.__version__,
                                         "python": platform.python_version(),
                                         "platform": f"{platform.system()}-{platform.machine()}"}, "fixtures": [{
        "id": "optuna-mipro-categorical-001", "file": "categorical.json",
        "evidence": "upstream-kernel",
        "sha256": hashlib.sha256(raw).hexdigest(),
        "generator": "scripts/fixtures/mipro_kernel.py",
        "description": "TPESampler ask/tell plus fixed-history joint categorical frequencies; includes FAIL.",
    }]}, indent=2) + "\n").encode()
    for name, data in [("categorical.json", raw), ("manifest.json", manifest)]:
        path = root / name
        if args.check:
            if path.read_bytes() != data:
                raise ValueError(f"Optuna kernel differs: {name}")
        else:
            root.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    print(f"{'Verified' if args.check else 'Generated'} Optuna 4.9.0 MIPRO kernel and hashes")


if __name__ == "__main__":
    main()
