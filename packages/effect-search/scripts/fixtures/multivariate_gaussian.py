"""FM-14: multivariate gaussian primitive parity fixtures."""

from __future__ import annotations

from typing import Any

import numpy as np
from optuna.samplers._tpe import _truncnorm

from ._common import metadata


def _diagonal_log_density(point: list[float], mean: list[float], sigmas: list[float]) -> float:
    if len(point) != len(mean) or len(mean) != len(sigmas):
        return float("-inf")

    total = 0.0
    for coordinate, current_mean, sigma in zip(point, mean, sigmas, strict=False):
        clamped_sigma = sigma if np.isfinite(sigma) and sigma > 0 else 1e-12
        normalized = (coordinate - current_mean) / clamped_sigma
        total += -0.5 * np.log(2 * np.pi) - np.log(clamped_sigma) - 0.5 * normalized * normalized

    return float(total)


def _scotts_factor(sample_count: int, dimensions: int) -> float:
    if sample_count <= 0 or dimensions <= 0:
        return 1.0
    return float(sample_count ** (-1 / (dimensions + 4)))


def _scotts_bandwidth(sample_count: int, dimensions: int, stddev: float) -> float:
    clamped_stddev = stddev if np.isfinite(stddev) and stddev > 0 else 1e-12
    return float(clamped_stddev * _scotts_factor(sample_count, dimensions))


def _normal_quantile_from_roll(roll: float) -> float:
    clamped = min(max(roll, 1e-12), 1 - 1e-12)
    return float(_truncnorm._ndtri_exp(np.asarray([np.log(clamped)], dtype=np.float64))[0])


def _sample_diagonal(mean: list[float], sigmas: list[float], rolls: list[float]) -> list[float]:
    return [
        float(current_mean + sigma * _normal_quantile_from_roll(roll))
        for current_mean, sigma, roll in zip(mean, sigmas, rolls, strict=False)
    ]


def _sample_mixture(
    means: list[list[float]],
    sigmas: list[list[float]],
    weights: list[float],
    component_roll: float,
    value_rolls: list[float],
) -> list[float]:
    clamped_weights = [max(float(weight), 0.0) for weight in weights]
    total_weight = float(sum(clamped_weights))
    normalized = (
        [weight / total_weight for weight in clamped_weights]
        if total_weight > 0
        else [1.0 / max(len(clamped_weights), 1)] * len(clamped_weights)
    )
    cumulative = np.cumsum(np.asarray(normalized, dtype=np.float64))
    if cumulative.size > 0:
        cumulative[-1] = 1.0
    index = int(min(np.sum(cumulative < component_roll), max(len(normalized) - 1, 0)))

    return _sample_diagonal(means[index], sigmas[index], value_rolls)


def _mixture_log_density(
    point: list[float],
    means: list[list[float]],
    sigmas: list[list[float]],
    weights: list[float],
) -> float:
    if len(means) <= 0:
        return float("-inf")

    clamped_weights = [max(float(weight), 0.0) for weight in weights]
    total_weight = float(sum(clamped_weights))
    normalized_weights = (
        [weight / total_weight for weight in clamped_weights]
        if total_weight > 0
        else [1.0 / len(means)] * len(means)
    )
    component_log_densities = [
        np.log(weight) + _diagonal_log_density(point, mean, sigma)
        for mean, sigma, weight in zip(means, sigmas, normalized_weights, strict=False)
        if weight > 0
    ]

    if len(component_log_densities) <= 0:
        return float("-inf")

    max_value = max(component_log_densities)
    return float(max_value + np.log(sum(np.exp(value - max_value) for value in component_log_densities)))


def _density_cases() -> list[dict[str, Any]]:
    cases = [
        {
            "id": "standard-origin",
            "point": [0.0, 0.0],
            "mean": [0.0, 0.0],
            "sigmas": [1.0, 1.0],
        },
        {
            "id": "unit-offset",
            "point": [1.0, -1.0],
            "mean": [0.0, 0.0],
            "sigmas": [1.0, 1.0],
        },
        {
            "id": "asymmetric-sigma",
            "point": [0.25, -0.5],
            "mean": [0.5, -0.75],
            "sigmas": [0.2, 0.4],
        },
    ]

    return [
        {
            **case,
            "expectedLogDensity": _diagonal_log_density(case["point"], case["mean"], case["sigmas"]),
        }
        for case in cases
    ]


def _bandwidth_cases() -> list[dict[str, Any]]:
    cases = [
        {
            "id": "10x2",
            "sampleCount": 10,
            "dimensions": 2,
            "stddev": 2.0,
        },
        {
            "id": "100x2",
            "sampleCount": 100,
            "dimensions": 2,
            "stddev": 2.0,
        },
    ]

    return [
        {
            **case,
            "expectedFactor": _scotts_factor(case["sampleCount"], case["dimensions"]),
            "expectedBandwidth": _scotts_bandwidth(case["sampleCount"], case["dimensions"], case["stddev"]),
        }
        for case in cases
    ]


def _sampling_cases() -> list[dict[str, Any]]:
    cases = [
        {
            "id": "kernel-a",
            "mean": [0.5, -1.0],
            "sigmas": [0.2, 0.4],
            "rolls": [0.1, 0.9],
        },
        {
            "id": "kernel-b",
            "mean": [1.25, 0.75],
            "sigmas": [0.35, 0.15],
            "rolls": [0.6, 0.3],
        },
    ]

    return [
        {
            **case,
            "expectedSample": _sample_diagonal(case["mean"], case["sigmas"], case["rolls"]),
        }
        for case in cases
    ]


def _mixture_case() -> dict[str, Any]:
    means = [[0.2, -0.3], [1.1, 0.6]]
    sigmas = [[0.1, 0.2], [0.3, 0.4]]
    weights = [0.75, 0.25]
    component_roll = 0.2
    value_rolls = [0.35, 0.7]
    expected_sample = _sample_mixture(means, sigmas, weights, component_roll, value_rolls)

    return {
        "means": means,
        "sigmas": sigmas,
        "weights": weights,
        "componentRoll": component_roll,
        "valueRolls": value_rolls,
        "expectedSample": expected_sample,
        "expectedLogDensity": _mixture_log_density(expected_sample, means, sigmas, weights),
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "multivariate-gaussian.parity",
            "file": "multivariate-gaussian/parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "densityCases": _density_cases(),
                "bandwidthCases": _bandwidth_cases(),
                "samplingCases": _sampling_cases(),
                "mixtureCase": _mixture_case(),
            },
        }
    ]
