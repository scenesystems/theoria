"""Numeric domain fixture generation from NumPy/SciPy reference implementations."""

from __future__ import annotations

import math
from typing import Any

import numpy

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    rng = numpy.random.RandomState(17)
    pairwise = []
    for size in [0, 7, 8, 9, 16, 127, 128, 129, 257]:
        values = rng.normal(size=size) * numpy.exp2(rng.randint(-40, 40, size=size))
        pairwise.append({"id": f"sum-pairwise-{size}", "operation": "sumPairwise",
                         "input": {"values": values.tolist()}, "expected": float(numpy.sum(values))})
    return [
        {
            "fixture": "numeric.scalar-parity",
            "file": "numeric/scalar-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    _log1p_case("log1p-zero", 0.0),
                    _log1p_case("log1p-tiny-positive", 1e-15),
                    _log1p_case("log1p-tiny-negative", -1e-15),
                    _log1p_case("log1p-small", 0.01),
                    _log1p_case("log1p-one", 1.0),
                    _log1p_case("log1p-large", 1e6),
                    _log1p_case("log1p-near-negative-one", -1.0 + 1e-14),
                    _expm1_case("expm1-zero", 0.0),
                    _expm1_case("expm1-tiny-positive", 1e-15),
                    _expm1_case("expm1-tiny-negative", -1e-15),
                    _expm1_case("expm1-small", 0.01),
                    _expm1_case("expm1-one", 1.0),
                    _expm1_case("expm1-large", 50.0),
                    _expm1_case("expm1-negative", -2.0),
                    _sum_case("sum-simple", [1.0, 2.0, 3.0, 4.0, 5.0]),
                    _sum_case("sum-cancellation", [1e16, 1.0, -1e16, 1.0]),
                    _sum_case("sum-single", [42.0]),
                    _sum_case("sum-alternating-sign", [1.0, -1.0, 1.0, -1.0, 1.0]),
                    _sum_case("sum-large-uniform", [0.1] * 100),
                    _sum_case("sum-mixed-magnitude", [1e-10, 1e10, 1e-10, -1e10]),
                    *pairwise,
                ]
            },
        }
    ]


def _log1p_case(case_id: str, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "log1p",
        "input": {"x": x},
        "expected": float(numpy.log1p(x)),
    }


def _expm1_case(case_id: str, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "expm1",
        "input": {"x": x},
        "expected": float(numpy.expm1(x)),
    }


def _sum_case(case_id: str, values: list[float]) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "sum",
        "input": {"values": values},
        "expected": float(math.fsum(values)),
    }
