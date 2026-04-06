"""Optimization domain fixture generation from SciPy reference implementations."""

from __future__ import annotations

import math
from typing import Any

from scipy import optimize

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "optimization.solver-parity",
            "file": "optimization/solver-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    # --- bisect (root-finding) ---
                    _bisect_case("bisect-x-squared-minus-2", "x_squared_minus_2", 0.0, 2.0),
                    _bisect_case("bisect-cos", "cos", 0.0, 2.0),
                    _bisect_case("bisect-x-cubed-minus-1", "x_cubed_minus_1", 0.0, 2.0),
                    _bisect_case("bisect-sin", "sin", 2.0, 4.0),
                    _bisect_case("bisect-exp-minus-2", "exp_minus_2", 0.0, 2.0),
                    _bisect_case("bisect-linear", "linear_2x_minus_3", 0.0, 3.0),
                    # --- goldenSection (1D minimization) ---
                    _golden_section_case("golden-x-squared", "x_squared", -2.0, 2.0),
                    _golden_section_case("golden-x-minus-1-squared", "x_minus_1_squared", -2.0, 4.0),
                    _golden_section_case("golden-x4-minus-x2", "x4_minus_x2", 0.0, 2.0),
                    _golden_section_case("golden-cos", "cos", 2.0, 5.0),
                    _golden_section_case("golden-abs-x", "abs_x", -3.0, 3.0),
                ]
            },
        },
        {
            "fixture": "optimization.root-finding-parity",
            "file": "optimization/root-finding-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    _root_case_brent("brent-x-squared-minus-2", "x_squared_minus_2", 0.0, 2.0),
                    _root_case_brent("brent-cos", "cos", 0.0, 2.0),
                    _root_case_brent("brent-exp-minus-2", "exp_minus_2", 0.0, 2.0),
                    _root_case_secant("secant-x-squared-minus-2", "x_squared_minus_2", 1.0, 2.0),
                    _root_case_secant("secant-cos", "cos", 1.0, 2.0),
                    _root_case_secant("secant-linear", "linear_2x_minus_3", 0.0, 2.0),
                    _root_case_newton("newton-x-squared-minus-2", "x_squared_minus_2", "dx_squared_minus_2", 1.5),
                    _root_case_newton("newton-cos", "cos", "dcos", 1.0),
                    _root_case_newton("newton-exp-minus-2", "exp_minus_2", "dexp_minus_2", 0.5),
                ]
            },
        }
    ]


_ROOT_FUNCTIONS = {
    "x_squared_minus_2": lambda x: x**2 - 2,
    "cos": math.cos,
    "x_cubed_minus_1": lambda x: x**3 - 1,
    "sin": math.sin,
    "exp_minus_2": lambda x: math.exp(x) - 2,
    "linear_2x_minus_3": lambda x: 2 * x - 3,
}

_ROOT_DERIVATIVES = {
    "dx_squared_minus_2": lambda x: 2 * x,
    "dcos": lambda x: -math.sin(x),
    "dexp_minus_2": math.exp,
}

_MINIMIZE_FUNCTIONS = {
    "x_squared": lambda x: x**2,
    "x_minus_1_squared": lambda x: (x - 1) ** 2,
    "x4_minus_x2": lambda x: x**4 - x**2,
    "cos": math.cos,
    "abs_x": abs,
}


def _bisect_case(case_id: str, func_name: str, a: float, b: float) -> dict[str, Any]:
    f = _ROOT_FUNCTIONS[func_name]
    result = float(optimize.bisect(f, a, b, xtol=1e-12))
    return {
        "id": case_id,
        "operation": "bisect",
        "input": {"function": func_name, "a": a, "b": b},
        "expected": result,
    }


def _golden_section_case(case_id: str, func_name: str, a: float, b: float) -> dict[str, Any]:
    f = _MINIMIZE_FUNCTIONS[func_name]
    result = optimize.minimize_scalar(f, bounds=(a, b), method="bounded")
    return {
        "id": case_id,
        "operation": "goldenSection",
        "input": {"function": func_name, "a": a, "b": b},
        "expected": float(result.x),
    }


def _root_expectation(value: float, residual: float) -> dict[str, float]:
    return {
        "root": float(value),
        "rootTolerance": 1e-8,
        "residualTolerance": max(float(residual), 1e-10),
    }


def _root_case_brent(case_id: str, func_name: str, lower_bound: float, upper_bound: float) -> dict[str, Any]:
    f = _ROOT_FUNCTIONS[func_name]
    result = optimize.root_scalar(f, bracket=(lower_bound, upper_bound), method="brentq", xtol=1e-12, rtol=1e-12)
    root = float(result.root)
    return {
        "id": case_id,
        "operation": "brent",
        "input": {"function": func_name, "lowerBound": lower_bound, "upperBound": upper_bound},
        "expected": _root_expectation(root, abs(f(root))),
    }


def _root_case_secant(case_id: str, func_name: str, previous_estimate: float, current_estimate: float) -> dict[str, Any]:
    f = _ROOT_FUNCTIONS[func_name]
    result = optimize.root_scalar(f, x0=previous_estimate, x1=current_estimate, method="secant", xtol=1e-12)
    root = float(result.root)
    return {
        "id": case_id,
        "operation": "secant",
        "input": {
            "function": func_name,
            "previousEstimate": previous_estimate,
            "currentEstimate": current_estimate,
        },
        "expected": _root_expectation(root, abs(f(root))),
    }


def _root_case_newton(case_id: str, func_name: str, derivative_name: str, initial_guess: float) -> dict[str, Any]:
    f = _ROOT_FUNCTIONS[func_name]
    derivative = _ROOT_DERIVATIVES[derivative_name]
    result = optimize.root_scalar(f, fprime=derivative, x0=initial_guess, method="newton", xtol=1e-12)
    root = float(result.root)
    return {
        "id": case_id,
        "operation": "newtonRaphson",
        "input": {
            "function": func_name,
            "derivative": derivative_name,
            "initialGuess": initial_guess,
        },
        "expected": _root_expectation(root, abs(f(root))),
    }
