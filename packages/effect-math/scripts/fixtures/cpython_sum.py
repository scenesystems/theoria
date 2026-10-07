#!/usr/bin/env -S uv run --locked
"""Execute CPython 3.12's builtin float ``sum`` for ``Numeric.sumNeumaier`` parity.

Every expected value is the result of the interpreter's own ``sum(values)`` on a
list of Python floats with the default integer start. Nothing here reimplements
the reduction. Floats are serialized as strings: ``repr`` for finite values
(including ``-0.0``) and ``NaN``/``Infinity``/``-Infinity`` otherwise, because
the reference includes IEEE edge cases that JSON numbers cannot carry.
The canonical Effect generator owns serialization, manifests and verification.
"""

from __future__ import annotations

import math
import os
import platform
import random
import sys
from typing import Any

# This family does not use NumPy; record a fixed dispatch environment anyway.
os.environ["NPY_DISABLE_CPU_FEATURES"] = "AVX2,FMA3,AVX512F"

FIXTURE = "cpython-sum-001"


def encode(value: float | int) -> str:
    if isinstance(value, float) and math.isnan(value):
        return "NaN"
    if isinstance(value, float) and math.isinf(value):
        return "Infinity" if value > 0 else "-Infinity"
    return repr(value)


def case(identifier: str, values: list[float]) -> dict[str, Any]:
    assert all(type(value) is float for value in values), identifier
    result = sum(values)
    assert type(result) is (float if values else int), identifier
    return {"id": identifier, "values": [encode(value) for value in values], "expected": encode(result)}


def edge_cases() -> list[dict[str, Any]]:
    inf, nan = math.inf, math.nan
    largest = sys.float_info.max
    return [
        case("empty", []),
        case("single", [0.1]),
        case("negative-zero", [-0.0]),
        case("negative-zeros", [-0.0, -0.0]),
        case("negative-zero-after-positive", [0.0, -0.0]),
        case("tenths", [0.1, 0.2, 0.3]),
        case("tenths-negative", [-0.1, -0.2, -0.3]),
        case("gepa-seed-subsample", [0.3, 0.3, 0.0]),
        case("gepa-child-subsample", [0.1, 0.2, 0.3]),
        case("gepa-child-permuted", [0.3, 0.1, 0.2]),
        case("ten-tenths", [0.1] * 10),
        case("mipro-percent-pair", [50.0, 60.0]),
        case("mipro-percent-fraction", [0.5, 0.6]),
        case("mipro-told-percentages", [14.38, 33.33, 66.67, 0.01, 99.99]),
        case("neumaier-large-middle", [1.0, 1e100, 1.0, -1e100]),
        case("cancellation", [1e16, 1.0, -1e16]),
        case("cancellation-tail", [1e16, 1.0, 1.0, -1e16]),
        case("subnormal", [5e-324, 5e-324, -5e-324]),
        case("normal-boundary", [2.2250738585072014e-308, -2.225073858507201e-308]),
        case("overflow", [largest, largest]),
        case("overflow-recovery", [largest, largest, -largest]),
        case("overflow-cancel", [largest, largest, -largest, -largest]),
        case("infinity", [inf]),
        case("infinity-then-finite", [inf, 1.0]),
        case("finite-then-infinity", [1.0, inf]),
        case("opposite-infinities", [inf, -inf]),
        case("negative-infinity", [-inf, largest]),
        case("nan-first", [nan, 1.0]),
        case("nan-last", [1.0, 2.0, nan]),
        case("compensation-exceeds-total", [1e-16, 1.0, -1.0]),
        case("compensation-negative-result", [-1.0, 1e-16, -1e-16, 1e-17]),
    ]


def seeded_cases() -> list[dict[str, Any]]:
    rng = random.Random(20261007)
    cases = []
    for size in [2, 3, 5, 8, 13, 31, 100, 257, 1000]:
        cases.append(case(f"wide-magnitude-{size}",
                          [rng.uniform(-1.0, 1.0) * 10.0 ** rng.randint(-20, 20) for _ in range(size)]))
        cases.append(case(f"grades-{size}", [rng.randint(0, 10) / 10 for _ in range(size)]))
        cases.append(case(f"unit-{size}", [rng.random() for _ in range(size)]))
    for size in [4, 16, 64]:
        head = [rng.uniform(-1.0, 1.0) * 10.0 ** rng.randint(0, 16) for _ in range(size)]
        cases.append(case(f"near-cancellation-{size}", head + [-value * (1.0 + 2.0 ** -40) for value in head]))
    return cases


def generate(generated_at: str) -> list[dict[str, Any]]:
    assert platform.python_implementation() == "CPython"
    assert sys.version_info[:2] == (3, 12), sys.version
    return [{
        "fixture": FIXTURE,
        "file": f"{FIXTURE}.json",
        "metadata": {
            "generatedAt": generated_at,
            "generator": {"script": "scripts/generate-scipy-fixtures.py"},
            "upstream": {"name": "cpython", "version": platform.python_version()},
        },
        "payload": {
            "runtime": {
                "implementation": platform.python_implementation(),
                "version": platform.python_version(),
                "platform": f"{platform.system()}-{platform.machine()}",
                "byteorder": sys.byteorder,
                "PYTHONHASHSEED": os.environ["PYTHONHASHSEED"],
                "NPY_DISABLE_CPU_FEATURES": os.environ["NPY_DISABLE_CPU_FEATURES"],
            },
            "cases": edge_cases() + seeded_cases(),
        },
    }]
