"""Algebra domain fixture generation from SciPy/NumPy reference implementations."""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "algebra.polynomial-parity",
            "file": "algebra/polynomial-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    # --- polyEval (Horner's method) ---
                    _poly_eval_case("polyEval-constant", [5.0], 3.0),
                    _poly_eval_case("polyEval-linear", [2.0, 3.0], 1.0),
                    _poly_eval_case("polyEval-quadratic", [1.0, -2.0, 1.0], 3.0),
                    _poly_eval_case("polyEval-cubic", [1.0, 0.0, -1.0, 2.0], 2.0),
                    _poly_eval_case("polyEval-zero", [1.0, 2.0, 3.0], 0.0),
                    _poly_eval_case("polyEval-negative-x", [1.0, 1.0, 1.0], -2.0),
                    _poly_eval_case("polyEval-high-degree", [1.0, 0.0, 0.0, 0.0, 1.0], 2.0),
                    _poly_eval_case("polyEval-fractional", [0.5, -1.5, 2.0], 1.5),
                    # --- polyDerivative ---
                    _poly_derivative_case("polyDeriv-constant", [5.0]),
                    _poly_derivative_case("polyDeriv-linear", [3.0, 2.0]),
                    _poly_derivative_case("polyDeriv-quadratic", [1.0, -2.0, 1.0]),
                    _poly_derivative_case("polyDeriv-cubic", [2.0, 0.0, -3.0, 1.0]),
                    _poly_derivative_case("polyDeriv-quartic", [1.0, 0.0, 0.0, 0.0, 1.0]),
                    # --- gcd ---
                    _gcd_case("gcd-coprime", 7, 13),
                    _gcd_case("gcd-common", 12, 8),
                    _gcd_case("gcd-equal", 6, 6),
                    _gcd_case("gcd-one", 1, 100),
                    _gcd_case("gcd-large", 462, 1071),
                    _gcd_case("gcd-zero-a", 0, 5),
                    _gcd_case("gcd-zero-b", 5, 0),
                    # --- lcm ---
                    _lcm_case("lcm-coprime", 7, 13),
                    _lcm_case("lcm-common", 12, 8),
                    _lcm_case("lcm-equal", 6, 6),
                    _lcm_case("lcm-one", 1, 100),
                    _lcm_case("lcm-large", 462, 1071),
                    # --- factorial ---
                    _factorial_case("factorial-0", 0),
                    _factorial_case("factorial-1", 1),
                    _factorial_case("factorial-5", 5),
                    _factorial_case("factorial-10", 10),
                    _factorial_case("factorial-12", 12),
                    _factorial_case("factorial-15", 15),
                    _factorial_case("factorial-20", 20),
                ]
            },
        }
    ]


def _poly_eval_case(case_id: str, coeffs: list[float], x: float) -> dict[str, Any]:
    # NumPy polyval expects highest-degree-first, our coeffs are lowest-degree-first
    # So reverse for numpy
    result = float(np.polyval(list(reversed(coeffs)), x))
    return {
        "id": case_id,
        "operation": "polyEval",
        "input": {"coefficients": coeffs, "x": x},
        "expected": result,
    }


def _poly_derivative_case(case_id: str, coeffs: list[float]) -> dict[str, Any]:
    # Our coefficients are lowest-degree-first: [a0, a1, a2, ...] = a0 + a1*x + a2*x^2 + ...
    # Derivative: [a1, 2*a2, 3*a3, ...]
    if len(coeffs) <= 1:
        deriv = [0.0]
    else:
        deriv = [float(i * coeffs[i]) for i in range(1, len(coeffs))]
    return {
        "id": case_id,
        "operation": "polyDerivative",
        "input": {"coefficients": coeffs},
        "expected": deriv,
    }


def _gcd_case(case_id: str, a: int, b: int) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "gcd",
        "input": {"a": a, "b": b},
        "expected": math.gcd(a, b),
    }


def _lcm_case(case_id: str, a: int, b: int) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "lcm",
        "input": {"a": a, "b": b},
        "expected": math.lcm(a, b),
    }


def _factorial_case(case_id: str, n: int) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "factorial",
        "input": {"n": n},
        "expected": float(math.factorial(n)),
    }
