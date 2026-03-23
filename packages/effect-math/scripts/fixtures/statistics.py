"""Statistics domain fixture generation from NumPy reference implementations."""

from __future__ import annotations

from typing import Any

import numpy as np

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "statistics.estimator-parity",
            "file": "statistics/estimator-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    _mean_case("mean-simple", [2, 4, 6, 8, 10]),
                    _mean_case("mean-negative", [-5, -3, -1, 1, 3]),
                    _mean_case("mean-single-pair", [1, 3]),
                    _mean_case("mean-constant", [7, 7, 7, 7]),
                    _mean_case("mean-large", list(range(1, 101))),
                    _variance_case("var-simple", [2, 4, 6, 8, 10]),
                    _variance_case("var-negative", [-5, -3, -1, 1, 3]),
                    _variance_case("var-constant", [7, 7, 7, 7]),
                    _variance_case("var-two-element", [1, 3]),
                    _variance_case("var-large", list(range(1, 101))),
                    _stddev_case("stddev-simple", [2, 4, 6, 8, 10]),
                    _stddev_case("stddev-negative", [-5, -3, -1, 1, 3]),
                    _stddev_case("stddev-constant", [7, 7, 7, 7]),
                    _covariance_case("cov-positive", [1, 2, 3, 4, 5], [2, 4, 6, 8, 10]),
                    _covariance_case("cov-negative", [1, 2, 3, 4, 5], [10, 8, 6, 4, 2]),
                    _covariance_case("cov-zero", [1, 2, 3, 4, 5], [5, 5, 5, 5, 5]),
                    _covariance_case("cov-identical", [1, 3, 5], [1, 3, 5]),
                    _min_max_case("minmax-simple", [3, 1, 4, 1, 5, 9, 2, 6]),
                    _min_max_case("minmax-negative", [-8, -3, -1, -5]),
                    _min_max_case("minmax-single-pair", [42, 17]),
                ]
            },
        }
    ]


def _mean_case(case_id: str, values: list[float]) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "mean",
        "input": {"values": values},
        "expected": float(np.mean(values)),
    }


def _variance_case(case_id: str, values: list[float]) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "variance",
        "input": {"values": values},
        "expected": float(np.var(values, ddof=1)),
    }


def _stddev_case(case_id: str, values: list[float]) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "standardDeviation",
        "input": {"values": values},
        "expected": float(np.std(values, ddof=1)),
    }


def _covariance_case(
    case_id: str, a: list[float], b: list[float]
) -> dict[str, Any]:
    cov_matrix = np.cov(a, b, ddof=1)
    return {
        "id": case_id,
        "operation": "covariance",
        "input": {"a": a, "b": b},
        "expected": float(cov_matrix[0, 1]),
    }


def _min_max_case(case_id: str, values: list[float]) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "minMax",
        "input": {"values": values},
        "expected": {"min": float(np.min(values)), "max": float(np.max(values))},
    }
