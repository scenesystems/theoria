"""LinearAlgebra domain fixture generation from NumPy reference implementations."""

from __future__ import annotations

from typing import Any

import numpy as np

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "linalg.vector-parity",
            "file": "linalg/vector-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    _dot_case("dot-unit", [1, 0, 0], [0, 1, 0]),
                    _dot_case("dot-parallel", [1, 2, 3], [4, 5, 6]),
                    _dot_case("dot-orthogonal", [1, 0], [0, 1]),
                    _dot_case("dot-negative", [-1, -2, -3], [4, 5, 6]),
                    _dot_case("dot-single", [7.0], [3.0]),
                    _dot_case("dot-large-5d", [1.5, 2.3, 3.7, 4.1, 5.9], [6.2, 7.8, 8.4, 9.1, 0.3]),
                    _norm_case("norm-l2-unit", [3, 4], "L2"),
                    _norm_case("norm-l2-3d", [1, 2, 3], "L2"),
                    _norm_case("norm-l1-basic", [1, -2, 3], "L1"),
                    _norm_case("norm-l1-single", [5.5], "L1"),
                    _norm_case("norm-linf-basic", [1, -5, 3], "Linf"),
                    _norm_case("norm-linf-equal", [3, 3, 3], "Linf"),
                    _norm_case("norm-l2-tiny", [1e-150, 1e-150], "L2"),
                    _norm_case("norm-l2-large", [1e150, 1e150], "L2"),
                    _matvec_case("matvec-identity-2x2", [1, 0, 0, 1], 2, 2, [3, 7]),
                    _matvec_case("matvec-scale-2x2", [2, 0, 0, 3], 2, 2, [4, 5]),
                    _matvec_case("matvec-rotation-like", [0, -1, 1, 0], 2, 2, [1, 0]),
                    _matvec_case("matvec-3x2", [1, 2, 3, 4, 5, 6], 3, 2, [1, 1]),
                    _frobenius_case("frobenius-identity-2x2", [1, 0, 0, 1], 2, 2),
                    _frobenius_case("frobenius-3x3", [1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 3),
                ]
            },
        }
    ]


def _dot_case(case_id: str, a: list[float], b: list[float]) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "dot",
        "input": {"a": a, "b": b},
        "expected": float(np.dot(a, b)),
    }


_NORM_MAP = {"L1": 1, "L2": 2, "Linf": np.inf}


def _norm_case(case_id: str, values: list[float], kind: str) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "norm",
        "input": {"values": values, "kind": kind},
        "expected": float(np.linalg.norm(values, ord=_NORM_MAP[kind])),
    }


def _matvec_case(
    case_id: str, data: list[float], rows: int, cols: int, x: list[float]
) -> dict[str, Any]:
    mat = np.array(data, dtype=np.float64).reshape(rows, cols)
    vec = np.array(x, dtype=np.float64)
    result = mat @ vec
    return {
        "id": case_id,
        "operation": "matvec",
        "input": {"data": data, "rows": rows, "cols": cols, "x": x},
        "expected": result.tolist(),
    }


def _frobenius_case(
    case_id: str, data: list[float], rows: int, cols: int
) -> dict[str, Any]:
    mat = np.array(data, dtype=np.float64).reshape(rows, cols)
    return {
        "id": case_id,
        "operation": "frobenius",
        "input": {"data": data, "rows": rows, "cols": cols},
        "expected": float(np.linalg.norm(mat, "fro")),
    }
