"""Calculus domain fixture generation from SciPy reference implementations."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from scipy import integrate

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "calculus.numerical-parity",
            "file": "calculus/numerical-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    # --- derivative (central finite difference) ---
                    _derivative_case("deriv-x-squared-at-1", "x_squared", 1.0),
                    _derivative_case("deriv-x-squared-at-3", "x_squared", 3.0),
                    _derivative_case("deriv-x-cubed-at-2", "x_cubed", 2.0),
                    _derivative_case("deriv-sin-at-0", "sin", 0.0),
                    _derivative_case("deriv-sin-at-pi-half", "sin", math.pi / 2),
                    _derivative_case("deriv-exp-at-0", "exp", 0.0),
                    _derivative_case("deriv-exp-at-1", "exp", 1.0),
                    _derivative_case("deriv-ln-at-1", "ln", 1.0),
                    _derivative_case("deriv-ln-at-2", "ln", 2.0),
                    # --- trapezoid (composite trapezoidal rule) ---
                    _trapezoid_case("trap-constant", [1.0, 1.0, 1.0, 1.0, 1.0], 0.25),
                    _trapezoid_case("trap-linear", [0.0, 1.0, 2.0, 3.0, 4.0], 1.0),
                    _trapezoid_case("trap-quadratic-5", [0.0, 1.0, 4.0, 9.0, 16.0], 1.0),
                    _trapezoid_case("trap-sine-quarter",
                                    [math.sin(i * math.pi / 20) for i in range(11)],
                                    math.pi / 20),
                    _trapezoid_case("trap-uniform-dx",
                                    [1.0, 4.0, 9.0, 16.0, 25.0], 0.5),
                    # --- simpson (composite Simpson's rule) ---
                    _simpson_case("simpson-constant", [2.0, 2.0, 2.0, 2.0, 2.0], 1.0),
                    _simpson_case("simpson-linear", [0.0, 1.0, 2.0, 3.0, 4.0], 1.0),
                    _simpson_case("simpson-quadratic", [0.0, 1.0, 4.0, 9.0, 16.0], 1.0),
                    _simpson_case("simpson-sine",
                                  [math.sin(i * math.pi / 20) for i in range(11)],
                                  math.pi / 20),
                    _simpson_case("simpson-cubic",
                                  [float(x**3) for x in range(5)], 1.0),
                ]
            },
        }
    ]


_FUNCTIONS = {
    "x_squared": lambda x: x**2,
    "x_cubed": lambda x: x**3,
    "sin": math.sin,
    "exp": math.exp,
    "ln": math.log,
}


def _central_difference(f, x: float, h: float = 1e-8) -> float:
    """Central finite difference approximation of f'(x)."""
    return (f(x + h) - f(x - h)) / (2 * h)


def _derivative_case(case_id: str, func_name: str, x: float) -> dict[str, Any]:
    f = _FUNCTIONS[func_name]
    result = float(_central_difference(f, x))
    return {
        "id": case_id,
        "operation": "derivative",
        "input": {"function": func_name, "x": x},
        "expected": result,
    }


def _trapezoid_case(case_id: str, values: list[float], dx: float) -> dict[str, Any]:
    result = float(np.trapz(np.array(values), dx=dx))
    return {
        "id": case_id,
        "operation": "trapezoid",
        "input": {"values": values, "dx": dx},
        "expected": result,
    }


def _simpson_case(case_id: str, values: list[float], dx: float) -> dict[str, Any]:
    result = float(integrate.simpson(np.array(values), dx=dx))
    return {
        "id": case_id,
        "operation": "simpson",
        "input": {"values": values, "dx": dx},
        "expected": result,
    }
