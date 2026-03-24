"""Geometry domain fixture generation from SciPy reference implementations."""

from __future__ import annotations

from typing import Any

from scipy.spatial import distance as sp_distance

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "geometry.distance-parity",
            "file": "geometry/distance-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    _distance_case("euclidean-2d-345", [0, 0], [3, 4], "euclidean"),
                    _distance_case("euclidean-3d", [1, 2, 3], [4, 5, 6], "euclidean"),
                    _distance_case("euclidean-identical", [1, 2], [1, 2], "euclidean"),
                    _distance_case("euclidean-negative", [-1, -2], [3, 4], "euclidean"),
                    _distance_case("euclidean-high-d", [1] * 100, [2] * 100, "euclidean"),
                    _distance_case("manhattan-2d", [0, 0], [3, 4], "manhattan"),
                    _distance_case("manhattan-3d", [1, 2, 3], [4, 5, 6], "manhattan"),
                    _distance_case("manhattan-identical", [5, 5], [5, 5], "manhattan"),
                    _distance_case("manhattan-negative", [-3, -1], [2, 4], "manhattan"),
                    _distance_case("chebyshev-2d", [0, 0], [3, 7], "chebyshev"),
                    _distance_case("chebyshev-3d", [1, 2, 3], [4, 1, 9], "chebyshev"),
                    _distance_case("chebyshev-identical", [1, 1], [1, 1], "chebyshev"),
                    _distance_case("chebyshev-negative", [-5, 2], [3, -1], "chebyshev"),
                    _distance_case("euclidean-tiny", [1e-300, 0], [0, 1e-300], "euclidean"),
                    _distance_case("euclidean-large", [1e150, 0], [0, 1e150], "euclidean"),
                    _midpoint_case("midpoint-2d", [0, 0], [4, 6]),
                    _midpoint_case("midpoint-3d", [1, 2, 3], [5, 6, 7]),
                    _midpoint_case("midpoint-negative", [-2, -4], [2, 4]),
                    _midpoint_case("midpoint-identical", [3, 3], [3, 3]),
                ]
            },
        }
    ]


_SCIPY_METRIC = {
    "euclidean": sp_distance.euclidean,
    "manhattan": sp_distance.cityblock,
    "chebyshev": sp_distance.chebyshev,
}


def _distance_case(
    case_id: str, a: list[float], b: list[float], metric: str
) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "distance",
        "input": {"a": a, "b": b, "metric": metric},
        "expected": float(_SCIPY_METRIC[metric](a, b)),
    }


def _midpoint_case(
    case_id: str, a: list[float], b: list[float]
) -> dict[str, Any]:
    import numpy as np
    mid = ((np.array(a) + np.array(b)) / 2.0).tolist()
    return {
        "id": case_id,
        "operation": "midpoint",
        "input": {"a": a, "b": b},
        "expected": mid,
    }
