"""FM-15: noise-aware bandwidth parity fixtures."""

from __future__ import annotations

from typing import Any

import numpy as np
from optuna.distributions import FloatDistribution
from optuna.samplers._tpe.parzen_estimator import _ParzenEstimator, _ParzenEstimatorParameters
from optuna.samplers._tpe.probability_distributions import _BatchedTruncNormDistributions
from optuna.samplers._tpe.sampler import default_weights

from ._common import metadata

NOISE_FLOOR = 1e-12
BOOTSTRAP_REPLICATES = 8
MAX_BANDWIDTH_SCALE = 5.0


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


def _parzen_sigmas(observations: list[float], low: float, high: float) -> list[float]:
    estimator = _ParzenEstimator(
        {"x": np.asarray(observations, dtype=np.float64)},
        {"x": FloatDistribution(low=low, high=high)},
        _parameters(),
    )
    distribution = estimator._mixture_distribution.distributions[0]

    if not isinstance(distribution, _BatchedTruncNormDistributions):
        raise TypeError("expected truncnorm batched distribution")

    return [float(value) for value in distribution.sigma]


def _average(values: list[float]) -> float:
    return float(sum(values) / len(values)) if values else 0.0


def _variance(values: list[float]) -> float:
    if len(values) <= 1:
        return 0.0

    mean = _average(values)
    return float(sum((value - mean) ** 2 for value in values) / len(values))


def _span(low: float, high: float) -> float:
    return float(max(high - low, NOISE_FLOOR))


def _bandwidth_from_sample(values: list[float], span: float) -> float:
    if len(values) <= 1:
        return span

    stddev = float(np.sqrt(_variance(values)))
    scott_factor = float(len(values) ** (-0.2))
    return float(max(stddev * scott_factor, NOISE_FLOOR))


def _bootstrap_index(observation_count: int, replicate_index: int, sample_index: int) -> int:
    if observation_count <= 0:
        return 0

    return ((replicate_index + 1) * 17 + (sample_index + 1) * 31) % observation_count


def _bootstrap_sample(observations: list[float], replicate_index: int) -> list[float]:
    return [
        observations[_bootstrap_index(len(observations), replicate_index, sample_index)]
        for sample_index in range(len(observations))
    ]


def _bootstrap_bandwidth_variance(observations: list[float], span: float) -> float:
    if len(observations) <= 1:
        return 0.0

    bandwidths = [
        _bandwidth_from_sample(_bootstrap_sample(observations, replicate_index), span)
        for replicate_index in range(BOOTSTRAP_REPLICATES)
    ]
    return _variance(bandwidths)


def _normalized_noise(observations: list[float], low: float, high: float) -> float:
    current_span = _span(low, high)
    observation_variance = _variance(observations)
    bootstrap_variance = _bootstrap_bandwidth_variance(observations, current_span)
    return float((observation_variance + bootstrap_variance) / (current_span * current_span))


def _bandwidth_scale(normalized_noise: float, alpha: float) -> float:
    return float(min(max(1 + max(alpha, 0.0) * normalized_noise, 1.0), MAX_BANDWIDTH_SCALE))


def _clip_sigma(sigma: float, low: float, high: float, n_kernels: int) -> float:
    max_sigma = high - low
    min_sigma = (high - low) / min(100, 1 + n_kernels)
    return float(min(max(sigma, min_sigma), max_sigma))


def _case(
    case_id: str,
    observations: list[float],
    low: float,
    high: float,
    alpha: float,
) -> dict[str, Any]:
    base_sigmas = _parzen_sigmas(observations, low, high)
    normalized_noise = _normalized_noise(observations, low, high)
    bandwidth_scale = _bandwidth_scale(normalized_noise, alpha)
    adjusted_sigmas = [
        _clip_sigma(sigma * bandwidth_scale, low, high, len(base_sigmas))
        for sigma in base_sigmas
    ]

    return {
        "id": case_id,
        "observations": observations,
        "low": low,
        "high": high,
        "alpha": alpha,
        "expected": {
            "baseSigmas": base_sigmas,
            "normalizedNoise": normalized_noise,
            "bandwidthScale": bandwidth_scale,
            "adjustedSigmas": adjusted_sigmas,
        },
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "noise-bandwidth.parity",
            "file": "noise-bandwidth/parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    _case(
                        "low-noise-smooth",
                        [0.12, 0.14, 0.15, 0.16, 0.18, 0.19],
                        0.0,
                        1.0,
                        1.5,
                    ),
                    _case(
                        "high-noise-zigzag",
                        [0.03, 0.94, 0.11, 0.88, 0.22, 0.79],
                        0.0,
                        1.0,
                        4.0,
                    ),
                    _case(
                        "cross-zero-range",
                        [-1.8, -0.4, 1.2, -1.1, 0.6, 1.7],
                        -2.0,
                        2.0,
                        3.0,
                    ),
                ]
            },
        }
    ]
