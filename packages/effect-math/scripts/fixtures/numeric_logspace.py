"""Log-space numeric domain fixture generation from NumPy/SciPy reference implementations."""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy import special as sp_special

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "numeric.logspace-parity",
            "file": "numeric/logspace-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    # --- logaddexp ---
                    _logaddexp_case("logaddexp-equal", 1.0, 1.0),
                    _logaddexp_case("logaddexp-one-larger", 10.0, 1.0),
                    _logaddexp_case("logaddexp-negative", -1.0, -2.0),
                    _logaddexp_case("logaddexp-large-magnitude", 100.0, 50.0),
                    _logaddexp_case("logaddexp-zero-zero", 0.0, 0.0),
                    # --- logsubexp ---
                    _logsubexp_case("logsubexp-a-gt-b", 5.0, 3.0),
                    _logsubexp_case("logsubexp-a-much-larger", 20.0, 1.0),
                    _logsubexp_case("logsubexp-close", 1.0, 0.9),
                    _logsubexp_case("logsubexp-large-gap", 100.0, 10.0),
                    _logsubexp_case("logsubexp-small", 0.5, 0.1),
                    # --- log1mexp ---
                    _log1mexp_case("log1mexp-small-neg", -0.1),
                    _log1mexp_case("log1mexp-half", -0.5),
                    _log1mexp_case("log1mexp-one", -1.0),
                    _log1mexp_case("log1mexp-two", -2.0),
                    _log1mexp_case("log1mexp-ten", -10.0),
                    # --- log1pexp ---
                    _log1pexp_case("log1pexp-neg10", -10.0),
                    _log1pexp_case("log1pexp-zero", 0.0),
                    _log1pexp_case("log1pexp-one", 1.0),
                    _log1pexp_case("log1pexp-ten", 10.0),
                    _log1pexp_case("log1pexp-large", 40.0),
                    # --- xlogy ---
                    _xlogy_case("xlogy-x-zero", 0.0, 5.0),
                    _xlogy_case("xlogy-one-e", 1.0, np.e),
                    _xlogy_case("xlogy-2-10", 2.0, 10.0),
                    _xlogy_case("xlogy-half-half", 0.5, 0.5),
                    _xlogy_case("xlogy-large", 10.0, 100.0),
                    # --- xlog1py ---
                    _xlog1py_case("xlog1py-x-zero", 0.0, 5.0),
                    _xlog1py_case("xlog1py-one-one", 1.0, 1.0),
                    _xlog1py_case("xlog1py-2-3", 2.0, 3.0),
                    _xlog1py_case("xlog1py-half-small", 0.5, 0.01),
                    _xlog1py_case("xlog1py-large", 10.0, 99.0),
                    # --- logsumexp ---
                    _logsumexp_case("logsumexp-small-array", [1.0, 2.0, 3.0]),
                    _logsumexp_case("logsumexp-large-array", [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]),
                    _logsumexp_case("logsumexp-all-same", [5.0, 5.0, 5.0, 5.0]),
                    _logsumexp_case("logsumexp-one-dominant", [100.0, 1.0, 2.0, 3.0]),
                    _logsumexp_case("logsumexp-negative", [-1.0, -2.0, -3.0, -4.0]),
                ]
            },
        }
    ]


def _logaddexp_case(case_id: str, a: float, b: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "logaddexp",
        "input": {"a": a, "b": b},
        "expected": float(np.logaddexp(a, b)),
    }


def _logsubexp_case(case_id: str, a: float, b: float) -> dict[str, Any]:
    expected = float(a + np.log1p(-np.exp(b - a)))
    return {
        "id": case_id,
        "operation": "logsubexp",
        "input": {"a": a, "b": b},
        "expected": expected,
    }


def _log1mexp_case(case_id: str, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "log1mexp",
        "input": {"x": x},
        "expected": float(np.log(1.0 - np.exp(x))),
    }


def _log1pexp_case(case_id: str, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "log1pexp",
        "input": {"x": x},
        "expected": float(np.log1p(np.exp(x))),
    }


def _xlogy_case(case_id: str, x: float, y: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "xlogy",
        "input": {"x": x, "y": y},
        "expected": float(sp_special.xlogy(x, y)),
    }


def _xlog1py_case(case_id: str, x: float, y: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "xlog1py",
        "input": {"x": x, "y": y},
        "expected": float(sp_special.xlog1py(x, y)),
    }


def _logsumexp_case(case_id: str, values: list[float]) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "logsumexp",
        "input": {"values": values},
        "expected": float(sp_special.logsumexp(values)),
    }
