"""FM-8: numerical density (continuous KDE) fixture generation from Optuna internals."""

from __future__ import annotations

from typing import Any

import numpy as np
from optuna.distributions import FloatDistribution
from optuna.samplers._tpe import _truncnorm
from optuna.samplers._tpe.parzen_estimator import _ParzenEstimator, _ParzenEstimatorParameters
from optuna.samplers._tpe.probability_distributions import _BatchedTruncNormDistributions
from optuna.samplers._tpe.sampler import default_weights

from ._common import metadata


def _parameters() -> _ParzenEstimatorParameters:
    return _ParzenEstimatorParameters(
        True,
        1.0,
        True,
        False,
        default_weights,
        False,
        {},
    )


def _build_estimator(observations: list[float], low: float, high: float) -> _ParzenEstimator:
    param_name = "x"
    search_space = {param_name: FloatDistribution(low=low, high=high)}
    observations_dict = {param_name: np.asarray(observations, dtype=np.float64)}
    return _ParzenEstimator(observations_dict, search_space, _parameters())


def _kernel_index(weights: np.ndarray, roll: float) -> int:
    cumulative = np.cumsum(weights)
    if cumulative.size > 0:
        cumulative[-1] = 1.0
    return int(min(np.sum(cumulative < roll), len(weights) - 1))


def _sample_from_roll(
    distribution: _BatchedTruncNormDistributions,
    weights: np.ndarray,
    kernel_roll: float,
    value_roll: float,
) -> float:
    index = _kernel_index(weights, kernel_roll)
    mu = float(distribution.mu[index])
    sigma = float(distribution.sigma[index])
    a = (distribution.low - mu) / sigma
    b = (distribution.high - mu) / sigma
    quantile = _truncnorm.ppf(np.asarray([value_roll], dtype=np.float64), np.asarray([a]), np.asarray([b]))

    return float(quantile[0] * sigma + mu)


def _fixture_from_case(generated_at: str, case: dict[str, Any]) -> dict[str, Any]:
    observations = case["observations"]
    low = case["low"]
    high = case["high"]
    probes = case["probes"]
    candidate_rolls = case["candidateRolls"]
    estimator = _build_estimator(observations, low, high)
    mixture = estimator._mixture_distribution
    distribution = mixture.distributions[0]

    if not isinstance(distribution, _BatchedTruncNormDistributions):
        raise TypeError("expected continuous truncnorm distribution")

    kernels = [
        {
            "mean": float(distribution.mu[index]),
            "sigma": float(distribution.sigma[index]),
            "weight": float(mixture.weights[index]),
        }
        for index in range(len(mixture.weights))
    ]
    log_density_values = estimator.log_pdf({"x": np.asarray(probes, dtype=np.float64)})
    log_density_trace = [
        {
            "probe": probe,
            "expected": float(log_density_values[index]),
        }
        for index, probe in enumerate(probes)
    ]
    expected_samples = [
        _sample_from_roll(
            distribution,
            mixture.weights,
            kernel_roll,
            value_roll,
        )
        for kernel_roll, value_roll in candidate_rolls
    ]

    return {
        "fixture": case["fixture"],
        "file": case["file"],
        "metadata": metadata(generated_at),
        "payload": {
            "observations": observations,
            "low": low,
            "high": high,
            "expected": {
                "kernels": kernels,
                "logDensities": log_density_trace,
                "candidateRolls": candidate_rolls,
                "expectedSamples": expected_samples,
            },
        },
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    default_rolls = [
        (0.1, 0.5),
        (0.35, 0.2),
        (0.6, 0.9),
        (0.95, 0.4),
    ]

    return [
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.basic",
                "file": "continuous-kde/basic.json",
                "observations": [0.2, 0.4, 0.7],
                "low": 0.0,
                "high": 1.0,
                "probes": [0.1, 0.6, 0.9],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.magic-clip",
                "file": "continuous-kde/magic-clip.json",
                "observations": [0.5001, 0.5002, 0.5003],
                "low": 0.0,
                "high": 1.0,
                "probes": [0.499, 0.5002, 0.8],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.prior-only",
                "file": "continuous-kde/prior-only.json",
                "observations": [],
                "low": 0.0,
                "high": 1.0,
                "probes": [0.1, 0.5, 0.9],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.recency-ramp",
                "file": "continuous-kde/recency-ramp.json",
                "observations": np.linspace(0.05, 0.95, 30, dtype=np.float64).tolist(),
                "low": 0.0,
                "high": 1.0,
                "probes": [0.12, 0.33, 0.77],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.boundary-low-skew",
                "file": "continuous-kde/boundary-low-skew.json",
                "observations": [0.0005, 0.0007, 0.001, 0.0015],
                "low": 0.0,
                "high": 1.0,
                "probes": [0.0, 0.0006, 0.01, 0.4],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.boundary-high-skew",
                "file": "continuous-kde/boundary-high-skew.json",
                "observations": [0.9985, 0.999, 0.9994, 0.9998],
                "low": 0.0,
                "high": 1.0,
                "probes": [0.6, 0.95, 0.999, 1.0],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.endpoint-observations",
                "file": "continuous-kde/endpoint-observations.json",
                "observations": [0.0, 0.0, 1.0, 1.0],
                "low": 0.0,
                "high": 1.0,
                "probes": [0.0, 0.0001, 0.5, 0.9999, 1.0],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.bimodal-separated",
                "file": "continuous-kde/bimodal-separated.json",
                "observations": [-8.5, -7.9, 7.4, 8.1],
                "low": -10.0,
                "high": 10.0,
                "probes": [-9.5, -8.0, 0.0, 8.0, 9.5],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.narrow-support",
                "file": "continuous-kde/narrow-support.json",
                "observations": [9.9991, 9.9993, 10.0002, 10.0004],
                "low": 9.999,
                "high": 10.001,
                "probes": [9.999, 9.9995, 10.0005, 10.001],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.wide-negative-range",
                "file": "continuous-kde/wide-negative-range.json",
                "observations": [-9.5, -2.2, 0.0, 3.8],
                "low": -12.0,
                "high": 8.0,
                "probes": [-11.0, -3.0, 1.0, 7.0],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.single-observation",
                "file": "continuous-kde/single-observation.json",
                "observations": [0.42],
                "low": 0.0,
                "high": 1.0,
                "probes": [0.05, 0.42, 0.95],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.outlier-cluster",
                "file": "continuous-kde/outlier-cluster.json",
                "observations": [0.001, 0.002, 0.003, 0.9],
                "low": 0.0,
                "high": 1.0,
                "probes": [0.0, 0.0025, 0.2, 0.9, 1.0],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.repeated-support-point",
                "file": "continuous-kde/repeated-support-point.json",
                "observations": [0.25, 0.25, 0.25, 0.8],
                "low": 0.0,
                "high": 1.0,
                "probes": [0.0, 0.25, 0.5, 0.8, 1.0],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.tiny-cross-zero-span",
                "file": "continuous-kde/tiny-cross-zero-span.json",
                "observations": [-0.0008, -0.0002, 0.0003, 0.0007],
                "low": -0.001,
                "high": 0.001,
                "probes": [-0.001, -0.0004, 0.0, 0.0004, 0.001],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.offset-positive-range",
                "file": "continuous-kde/offset-positive-range.json",
                "observations": [100.2, 100.7, 104.4, 108.8],
                "low": 100.0,
                "high": 110.0,
                "probes": [100.0, 100.5, 105.0, 109.5],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.micro-positive-span",
                "file": "continuous-kde/micro-positive-span.json",
                "observations": [0.5000004, 0.5000011, 0.5000028, 0.5000032],
                "low": 0.5,
                "high": 0.500004,
                "probes": [0.5, 0.5000008, 0.500002, 0.5000036, 0.500004],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.extreme-asymmetric-range",
                "file": "continuous-kde/extreme-asymmetric-range.json",
                "observations": [-49.5, -48.9, -30.2, 0.6],
                "low": -50.0,
                "high": 1.0,
                "probes": [-50.0, -49.0, -35.0, -5.0, 1.0],
                "candidateRolls": default_rolls,
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "continuous-kde.upper-boundary-cluster",
                "file": "continuous-kde/upper-boundary-cluster.json",
                "observations": [9.6, 9.8, 9.95, 10.0, 10.0],
                "low": 0.0,
                "high": 10.0,
                "probes": [0.0, 5.0, 9.7, 9.98, 10.0],
                "candidateRolls": default_rolls,
            },
        ),
    ]
