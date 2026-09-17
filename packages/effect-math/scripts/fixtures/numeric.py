"""Numeric domain fixture generation from NumPy/SciPy reference implementations."""

from __future__ import annotations

import math
from typing import Any

import numpy

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
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
                ]
            },
        },
        {
            "fixture": "numeric.elementary-parity",
            "file": "numeric/elementary-parity.json",
            "metadata": metadata(generated_at),
            "payload": {"cases": _elementary_cases()},
        },
    ]


def _elementary_cases() -> list[dict[str, Any]]:
    """Exercise reduction boundaries and full-exponent inputs independently.

    Three binary64 spacings allow NumPy's platform libm and the scalar fdlibm
    approximations to round differently; sqrt is required to agree exactly.
    Close-to-zero trigonometric residuals use spacing, not an absolute epsilon.
    """
    rng = numpy.random.default_rng(117)
    tiny = [0.0, 5e-324, 1e-308, 2.0**-54, 2.0**-29, 1e-15]
    signed = tiny + [-x for x in tiny]
    positive = list(numpy.ldexp(rng.uniform(1, 2, 96), rng.integers(-1074, 1024, 96)))
    positive += [5e-324, numpy.finfo(float).tiny, numpy.finfo(float).max, 1.0, 10.0, 1000.0]
    angles = list(rng.uniform(-1_647_100, 1_647_100, 96))
    angles += [1e20, -1e20, 1e100, 1e300, numpy.finfo(float).max]
    boundaries = [0.0, numpy.pi / 4, numpy.pi / 2, numpy.pi, 2 * numpy.pi, 1_647_099.0]
    angles += [float(numpy.nextafter(x, direction)) for x in boundaries for direction in [-numpy.inf, numpy.inf]]
    angles += [-x for x in angles]
    exponential = list(rng.uniform(-745, 709.78, 96)) + signed
    exponential += [709.782712893384, -745.1332191019411, 700.0, -700.0, 1.0]
    reductions = [0.34657359027997264, 1.0397207708399179, -0.2928934097290039, 0.4142136573791504, 0.5]
    reductions = [float(numpy.nextafter(x, direction)) for x in reductions for direction in [-numpy.inf, numpy.inf]]
    inputs = {
        "log": (numpy.log, positive),
        "log10": (numpy.log10, positive),
        "sqrt": (numpy.sqrt, positive),
        "log1p": (numpy.log1p, signed + reductions + list(rng.uniform(-0.999999, 2, 96)) + positive),
        "exp": (numpy.exp, exponential),
        "expm1": (numpy.expm1, exponential + reductions + list(rng.uniform(-1, 1, 96))),
        "sin": (numpy.sin, angles + signed),
        "cos": (numpy.cos, angles + signed),
        "atan": (numpy.arctan, list(rng.uniform(-10, 10, 96)) + signed + positive),
        "sinh": (numpy.sinh, list(rng.uniform(-710, 710, 96)) + signed + [710.0, -710.0]),
        "cosh": (numpy.cosh, list(rng.uniform(-710, 710, 96)) + signed + [710.0, -710.0]),
    }
    cases = []
    for operation, (evaluate, values) in inputs.items():
        for index, x in enumerate(values):
            expected = float(evaluate(x))
            cases.append({
                "id": f"{operation}-{index}",
                "operation": operation,
                "input": {"x": float(x)},
                "expected": expected,
                "tolerance": 0.0 if operation == "sqrt" else float(3 * abs(numpy.spacing(expected))),
            })
    return cases


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
