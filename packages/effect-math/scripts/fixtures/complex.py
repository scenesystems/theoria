"""Complex-number domain fixture generation from NumPy reference implementations."""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []

    # ── Arithmetic ──────────────────────────────────────────────────────
    _arith_pairs: list[tuple[str, complex, complex]] = [
        ("unit", 1 + 2j, 3 + 4j),
        ("pure-real", 5 + 0j, -3 + 0j),
        ("pure-imag", 0 + 2j, 0 - 7j),
        ("large", 1e8 + 1e8j, 2e8 - 3e8j),
        ("small", 1e-12 + 1e-12j, 2e-12 + 3e-12j),
    ]

    for label, a, b in _arith_pairs:
        cases.append(_binary_case(f"add-{label}", "add", a, b, a + b))
        cases.append(_binary_case(f"subtract-{label}", "subtract", a, b, a - b))
        cases.append(_binary_case(f"multiply-{label}", "multiply", a, b, a * b))
        cases.append(_binary_case(f"divide-{label}", "divide", a, b, a / b))

    # ── Unary ───────────────────────────────────────────────────────────
    _unary_inputs: list[tuple[str, complex]] = [
        ("unit", 3 + 4j),
        ("pure-real", -5 + 0j),
        ("pure-imag", 0 + 7j),
        ("negative-both", -2 - 3j),
    ]

    for label, z in _unary_inputs:
        cases.append(_unary_complex_case(f"conjugate-{label}", "conjugate", z, z.conjugate()))
        cases.append(_unary_scalar_case(f"abs-{label}", "abs", z, abs(z)))
        cases.append(_unary_scalar_case(f"arg-{label}", "arg", z, np.angle(z)))

    # ── Transcendental ──────────────────────────────────────────────────
    _trans_inputs: list[tuple[str, complex]] = [
        ("unit", 1 + 1j),
        ("pure-real-neg", -1.0 + 0j),
        ("pure-imag", 0 + 3j),
        ("general", 0.5 - 1.5j),
    ]

    for label, z in _trans_inputs:
        cases.append(_unary_complex_case(f"exp-{label}", "exp", z, np.exp(z)))
        cases.append(_unary_complex_case(f"log-{label}", "log", z, np.log(z)))
        cases.append(_unary_complex_case(f"sqrt-{label}", "sqrt", z, np.sqrt(z)))

    # pow with complex exponent
    _pow_pairs: list[tuple[str, complex, complex]] = [
        ("int-exp", 2 + 1j, 3 + 0j),
        ("complex-exp", 1 + 1j, 1 + 1j),
        ("neg-base", -1 + 0j, 0.5 + 0j),
    ]

    for label, base, exp in _pow_pairs:
        cases.append(_pow_case(f"pow-{label}", base, exp, base**exp))

    # ── Trigonometric ───────────────────────────────────────────────────
    _trig_inputs: list[tuple[str, complex]] = [
        ("unit", 1 + 1j),
        ("pure-imag", 0 + 2j),
        ("general", 0.5 - 0.5j),
    ]

    for label, z in _trig_inputs:
        cases.append(_unary_complex_case(f"sin-{label}", "sin", z, np.sin(z)))
        cases.append(_unary_complex_case(f"cos-{label}", "cos", z, np.cos(z)))
        cases.append(_unary_complex_case(f"tan-{label}", "tan", z, np.tan(z)))

    # ── Hyperbolic ──────────────────────────────────────────────────────
    _hyp_inputs: list[tuple[str, complex]] = [
        ("unit", 1 + 1j),
        ("pure-imag", 0 + 2j),
        ("general", -1 + 0.5j),
    ]

    for label, z in _hyp_inputs:
        cases.append(_unary_complex_case(f"sinh-{label}", "sinh", z, np.sinh(z)))
        cases.append(_unary_complex_case(f"cosh-{label}", "cosh", z, np.cosh(z)))
        cases.append(_unary_complex_case(f"tanh-{label}", "tanh", z, np.tanh(z)))

    # ── Polar ───────────────────────────────────────────────────────────
    _polar_inputs: list[tuple[str, complex]] = [
        ("unit", 1 + 1j),
        ("pure-real-neg", -3 + 0j),
        ("general", 3 - 4j),
    ]

    for label, z in _polar_inputs:
        r = abs(z)
        theta = float(np.angle(z))
        cases.append({
            "id": f"toPolar-{label}",
            "operation": "toPolar",
            "input": {"re": z.real, "im": z.imag},
            "expected": {"r": float(r), "theta": theta},
        })

    # ── Complex-step derivative ─────────────────────────────────────────
    h = 1e-20
    _deriv_fns: list[tuple[str, str]] = [
        ("square", "square"),
        ("cube", "cube"),
        ("sin", "sin"),
        ("exp", "exp"),
    ]
    _deriv_points: list[tuple[str, float]] = [
        ("at-0", 0.0),
        ("at-1", 1.0),
        ("at-2", 2.0),
    ]

    for fn_label, fn_name in _deriv_fns:
        for pt_label, x in _deriv_points:
            z = complex(x, h)
            if fn_name == "square":
                fval = z ** 2
            elif fn_name == "cube":
                fval = z ** 3
            elif fn_name == "sin":
                fval = np.sin(z)
            elif fn_name == "exp":
                fval = np.exp(z)
            else:
                raise ValueError(f"Unknown function: {fn_name}")

            cases.append({
                "id": f"complexDerivative-{fn_label}-{pt_label}",
                "operation": "complexDerivative",
                "input": {"fn": fn_name, "x": x},
                "expected": float(fval.imag / h),
            })

    return [
        {
            "fixture": "complex.arithmetic-parity",
            "file": "complex/arithmetic-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": cases,
            },
        }
    ]


# ── Helper factories ────────────────────────────────────────────────────


def _binary_case(
    case_id: str, operation: str, a: complex, b: complex, result: complex
) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": operation,
        "input": {
            "aRe": float(a.real),
            "aIm": float(a.imag),
            "bRe": float(b.real),
            "bIm": float(b.imag),
        },
        "expected": {"re": float(result.real), "im": float(result.imag)},
    }


def _unary_complex_case(
    case_id: str, operation: str, z: complex, result: complex
) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": operation,
        "input": {"re": float(z.real), "im": float(z.imag)},
        "expected": {"re": float(result.real), "im": float(result.imag)},
    }


def _unary_scalar_case(
    case_id: str, operation: str, z: complex, result: float
) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": operation,
        "input": {"re": float(z.real), "im": float(z.imag)},
        "expected": float(result),
    }


def _pow_case(
    case_id: str, base: complex, exp: complex, result: complex
) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "pow",
        "input": {
            "baseRe": float(base.real),
            "baseIm": float(base.imag),
            "expRe": float(exp.real),
            "expIm": float(exp.imag),
        },
        "expected": {"re": float(result.real), "im": float(result.imag)},
    }
