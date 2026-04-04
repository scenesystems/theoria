"""Mixed-space joint EI trace fixtures from Optuna internals."""

from __future__ import annotations

from typing import Any

import numpy as np
from optuna.distributions import CategoricalDistribution, FloatDistribution
from optuna.samplers._tpe import _truncnorm
from optuna.samplers._tpe.parzen_estimator import _ParzenEstimator, _ParzenEstimatorParameters
from optuna.samplers._tpe.probability_distributions import (
    _BatchedCategoricalDistributions,
    _BatchedTruncNormDistributions,
)
from optuna.samplers._tpe.sampler import default_weights

from ._common import metadata

OPTIMIZER_CHOICES = ["adam", "sgd", "adamw"]

LR_LOW = 0.0005
LR_HIGH = 0.2
DEPTH_LOW = 1
DEPTH_HIGH = 8
DEPTH_STEP = 1


def _to_roll_pair(roll: Any) -> tuple[float, float]:
    if isinstance(roll, tuple):
        return float(roll[0]), float(roll[1])

    return float(roll["kernelRoll"]), float(roll["valueRoll"])


def _to_roll_pairs(rolls: list[Any]) -> list[tuple[float, float]]:
    return [_to_roll_pair(roll) for roll in rolls]

SCENARIOS: list[dict[str, Any]] = [
    {
        "fixture": "mixed-space.joint-trace",
        "file": "mixed-space/joint-trace.json",
        "seed": 41,
        "below": [
            {"trialNumber": 1, "config": {"optimizer": "adam", "lr": 0.009, "depth": 5}, "value": 0.11},
            {"trialNumber": 2, "config": {"optimizer": "adam", "lr": 0.014, "depth": 4}, "value": 0.16},
            {"trialNumber": 3, "config": {"optimizer": "adamw", "lr": 0.018, "depth": 5}, "value": 0.18},
            {"trialNumber": 4, "config": {"optimizer": "adam", "lr": 0.022, "depth": 6}, "value": 0.19},
            {"trialNumber": 5, "config": {"optimizer": "adamw", "lr": 0.012, "depth": 5}, "value": 0.17},
            {"trialNumber": 6, "config": {"optimizer": "adam", "lr": 0.03, "depth": 4}, "value": 0.21},
        ],
        "above": [
            {"trialNumber": 7, "config": {"optimizer": "sgd", "lr": 0.08, "depth": 2}, "value": 0.72},
            {"trialNumber": 8, "config": {"optimizer": "sgd", "lr": 0.12, "depth": 3}, "value": 0.83},
            {"trialNumber": 9, "config": {"optimizer": "sgd", "lr": 0.16, "depth": 1}, "value": 0.91},
            {"trialNumber": 10, "config": {"optimizer": "adamw", "lr": 0.14, "depth": 2}, "value": 0.68},
            {"trialNumber": 11, "config": {"optimizer": "adam", "lr": 0.11, "depth": 7}, "value": 0.62},
            {"trialNumber": 12, "config": {"optimizer": "sgd", "lr": 0.2, "depth": 8}, "value": 1.05},
            {"trialNumber": 13, "config": {"optimizer": "adamw", "lr": 0.09, "depth": 3}, "value": 0.58},
            {"trialNumber": 14, "config": {"optimizer": "adam", "lr": 0.07, "depth": 2}, "value": 0.51},
            {"trialNumber": 15, "config": {"optimizer": "sgd", "lr": 0.05, "depth": 6}, "value": 0.57},
            {"trialNumber": 16, "config": {"optimizer": "adamw", "lr": 0.13, "depth": 7}, "value": 0.74},
            {"trialNumber": 17, "config": {"optimizer": "adam", "lr": 0.19, "depth": 8}, "value": 0.95},
            {"trialNumber": 18, "config": {"optimizer": "sgd", "lr": 0.09, "depth": 4}, "value": 0.64},
        ],
        "categoricalRolls": [0.01, 0.17, 0.29, 0.43, 0.57, 0.71, 0.86, 0.97],
        "floatRolls": [
            {"kernelRoll": 0.03, "valueRoll": 0.19},
            {"kernelRoll": 0.14, "valueRoll": 0.71},
            {"kernelRoll": 0.22, "valueRoll": 0.42},
            {"kernelRoll": 0.39, "valueRoll": 0.84},
            {"kernelRoll": 0.51, "valueRoll": 0.31},
            {"kernelRoll": 0.66, "valueRoll": 0.58},
            {"kernelRoll": 0.82, "valueRoll": 0.12},
            {"kernelRoll": 0.95, "valueRoll": 0.93},
        ],
        "intRolls": [
            {"kernelRoll": 0.06, "valueRoll": 0.11},
            {"kernelRoll": 0.18, "valueRoll": 0.67},
            {"kernelRoll": 0.27, "valueRoll": 0.38},
            {"kernelRoll": 0.36, "valueRoll": 0.82},
            {"kernelRoll": 0.48, "valueRoll": 0.26},
            {"kernelRoll": 0.63, "valueRoll": 0.59},
            {"kernelRoll": 0.77, "valueRoll": 0.44},
            {"kernelRoll": 0.91, "valueRoll": 0.95},
        ],
    },
    {
        "fixture": "mixed-space.joint-trace.recency-shift",
        "file": "mixed-space/joint-trace-recency-shift.json",
        "seed": 73,
        "below": [
            {"trialNumber": 1, "config": {"optimizer": "adam", "lr": 0.002, "depth": 3}, "value": 0.08},
            {"trialNumber": 2, "config": {"optimizer": "adamw", "lr": 0.006, "depth": 4}, "value": 0.1},
            {"trialNumber": 3, "config": {"optimizer": "sgd", "lr": 0.01, "depth": 2}, "value": 0.11},
            {"trialNumber": 4, "config": {"optimizer": "adam", "lr": 0.015, "depth": 5}, "value": 0.12},
            {"trialNumber": 5, "config": {"optimizer": "adamw", "lr": 0.025, "depth": 6}, "value": 0.13},
            {"trialNumber": 6, "config": {"optimizer": "adam", "lr": 0.04, "depth": 4}, "value": 0.14},
            {"trialNumber": 7, "config": {"optimizer": "sgd", "lr": 0.03, "depth": 3}, "value": 0.15},
        ],
        "above": [
            {"trialNumber": 8, "config": {"optimizer": "sgd", "lr": 0.12, "depth": 8}, "value": 0.9},
            {"trialNumber": 9, "config": {"optimizer": "adamw", "lr": 0.18, "depth": 7}, "value": 1.0},
            {"trialNumber": 10, "config": {"optimizer": "sgd", "lr": 0.16, "depth": 6}, "value": 0.95},
            {"trialNumber": 11, "config": {"optimizer": "adam", "lr": 0.09, "depth": 8}, "value": 0.88},
            {"trialNumber": 12, "config": {"optimizer": "adamw", "lr": 0.14, "depth": 7}, "value": 0.92},
            {"trialNumber": 13, "config": {"optimizer": "sgd", "lr": 0.2, "depth": 5}, "value": 1.1},
            {"trialNumber": 14, "config": {"optimizer": "adam", "lr": 0.11, "depth": 6}, "value": 0.85},
            {"trialNumber": 15, "config": {"optimizer": "adamw", "lr": 0.13, "depth": 8}, "value": 0.97},
            {"trialNumber": 16, "config": {"optimizer": "sgd", "lr": 0.08, "depth": 5}, "value": 0.8},
            {"trialNumber": 17, "config": {"optimizer": "adam", "lr": 0.07, "depth": 7}, "value": 0.82},
            {"trialNumber": 18, "config": {"optimizer": "adamw", "lr": 0.1, "depth": 6}, "value": 0.86},
            {"trialNumber": 19, "config": {"optimizer": "sgd", "lr": 0.15, "depth": 4}, "value": 0.89},
        ],
        "categoricalRolls": [0.04, 0.15, 0.28, 0.41, 0.55, 0.68, 0.83, 0.96],
        "floatRolls": [
            {"kernelRoll": 0.05, "valueRoll": 0.14},
            {"kernelRoll": 0.16, "valueRoll": 0.74},
            {"kernelRoll": 0.24, "valueRoll": 0.39},
            {"kernelRoll": 0.35, "valueRoll": 0.88},
            {"kernelRoll": 0.49, "valueRoll": 0.27},
            {"kernelRoll": 0.61, "valueRoll": 0.63},
            {"kernelRoll": 0.79, "valueRoll": 0.19},
            {"kernelRoll": 0.94, "valueRoll": 0.91},
        ],
        "intRolls": [
            {"kernelRoll": 0.08, "valueRoll": 0.13},
            {"kernelRoll": 0.19, "valueRoll": 0.69},
            {"kernelRoll": 0.31, "valueRoll": 0.36},
            {"kernelRoll": 0.42, "valueRoll": 0.86},
            {"kernelRoll": 0.54, "valueRoll": 0.24},
            {"kernelRoll": 0.67, "valueRoll": 0.57},
            {"kernelRoll": 0.81, "valueRoll": 0.47},
            {"kernelRoll": 0.93, "valueRoll": 0.97},
        ],
    },
]


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


def _pick_index_by_roll(weights: np.ndarray, roll: float) -> int:
    cumulative = np.cumsum(weights)
    if cumulative.size > 0:
        cumulative[-1] = 1.0
    return int(min(np.sum(cumulative < roll), len(weights) - 1))


def _safe_log(value: float) -> float:
    return float(np.log(value)) if value > 0 else float("-inf")


def _categorical_estimator(observations: list[str]) -> _ParzenEstimator:
    search_space = {"optimizer": CategoricalDistribution(OPTIMIZER_CHOICES)}
    encoded = np.asarray([OPTIMIZER_CHOICES.index(value) for value in observations], dtype=np.float64)
    return _ParzenEstimator({"optimizer": encoded}, search_space, _parameters())


def _float_estimator(observations: list[float]) -> _ParzenEstimator:
    search_space = {"lr": FloatDistribution(low=LR_LOW, high=LR_HIGH, log=True)}
    return _ParzenEstimator({"lr": np.asarray(observations, dtype=np.float64)}, search_space, _parameters())


def _int_estimator(observations: list[int]) -> _ParzenEstimator:
    search_space = {
        "depth": FloatDistribution(low=DEPTH_LOW - 0.5 * DEPTH_STEP, high=DEPTH_HIGH + 0.5 * DEPTH_STEP)
    }
    return _ParzenEstimator({"depth": np.asarray(observations, dtype=np.float64)}, search_space, _parameters())


def _categorical_probabilities(estimator: _ParzenEstimator) -> np.ndarray:
    mixture = estimator._mixture_distribution
    distribution = mixture.distributions[0]

    if not isinstance(distribution, _BatchedCategoricalDistributions):
        raise TypeError("expected batched categorical distribution")

    probabilities = np.sum(mixture.weights[:, np.newaxis] * distribution.weights, axis=0)
    return probabilities.astype(np.float64)


def _sample_log_float_from_roll(estimator: _ParzenEstimator, roll: tuple[float, float]) -> float:
    mixture = estimator._mixture_distribution
    distribution = mixture.distributions[0]

    if not isinstance(distribution, _BatchedTruncNormDistributions):
        raise TypeError("expected batched truncnorm distribution")

    index = _pick_index_by_roll(mixture.weights, roll[0])
    mu = float(distribution.mu[index])
    sigma = float(distribution.sigma[index])
    a = (distribution.low - mu) / sigma
    b = (distribution.high - mu) / sigma
    quantile = _truncnorm.ppf(
        np.asarray([roll[1]], dtype=np.float64),
        np.asarray([a]),
        np.asarray([b]),
    )
    sample = float(quantile[0] * sigma + mu)

    return float(np.exp(sample))


def _sample_int_from_roll(estimator: _ParzenEstimator, roll: tuple[float, float]) -> tuple[float, int]:
    mixture = estimator._mixture_distribution
    distribution = mixture.distributions[0]

    if not isinstance(distribution, _BatchedTruncNormDistributions):
        raise TypeError("expected batched truncnorm distribution")

    index = _pick_index_by_roll(mixture.weights, roll[0])
    mu = float(distribution.mu[index])
    sigma = float(distribution.sigma[index])
    a = (distribution.low - mu) / sigma
    b = (distribution.high - mu) / sigma
    quantile = _truncnorm.ppf(
        np.asarray([roll[1]], dtype=np.float64),
        np.asarray([a]),
        np.asarray([b]),
    )
    sampled = float(quantile[0] * sigma + mu)
    quantized = int(np.clip(DEPTH_LOW + np.round(sampled - DEPTH_LOW), DEPTH_LOW, DEPTH_HIGH))

    return sampled, quantized


def _categorical_trace(
    below: _ParzenEstimator,
    above: _ParzenEstimator,
    rolls: list[float],
) -> dict[str, Any]:
    below_probabilities = _categorical_probabilities(below)
    above_probabilities = _categorical_probabilities(above)
    candidates = [
        OPTIMIZER_CHOICES[_pick_index_by_roll(below_probabilities, roll)]
        for roll in rolls
    ]
    scores = []
    log_l = []
    log_g = []

    for candidate in candidates:
        index = OPTIMIZER_CHOICES.index(candidate)
        l_value = _safe_log(float(below_probabilities[index]))
        g_value = _safe_log(float(above_probabilities[index]))
        log_l.append(l_value)
        log_g.append(g_value)
        scores.append(l_value - g_value)

    return {
        "kind": "categorical",
        "name": "optimizer",
        "candidateRolls": rolls,
        "candidates": candidates,
        "logL": log_l,
        "logG": log_g,
        "scores": scores,
    }


def _float_trace(
    below: _ParzenEstimator,
    above: _ParzenEstimator,
    rolls: list[tuple[float, float]],
) -> dict[str, Any]:
    candidates = [_sample_log_float_from_roll(below, roll) for roll in rolls]
    log_l = below.log_pdf({"lr": np.asarray(candidates, dtype=np.float64)}).astype(np.float64)
    log_g = above.log_pdf({"lr": np.asarray(candidates, dtype=np.float64)}).astype(np.float64)
    scores = (log_l - log_g).astype(np.float64)

    return {
        "kind": "float",
        "name": "lr",
        "candidateRolls": rolls,
        "candidates": [float(value) for value in candidates],
        "logL": log_l.tolist(),
        "logG": log_g.tolist(),
        "scores": scores.tolist(),
    }


def _int_trace(
    below: _ParzenEstimator,
    above: _ParzenEstimator,
    rolls: list[tuple[float, float]],
) -> dict[str, Any]:
    sampled_candidates = [_sample_int_from_roll(below, roll) for roll in rolls]
    model_candidates = [sample[0] for sample in sampled_candidates]
    candidates = [sample[1] for sample in sampled_candidates]
    log_l = below.log_pdf({"depth": np.asarray(model_candidates, dtype=np.float64)}).astype(np.float64)
    log_g = above.log_pdf({"depth": np.asarray(model_candidates, dtype=np.float64)}).astype(np.float64)
    scores = (log_l - log_g).astype(np.float64)

    return {
        "kind": "int",
        "name": "depth",
        "candidateRolls": rolls,
        "candidates": [int(value) for value in candidates],
        "logL": log_l.tolist(),
        "logG": log_g.tolist(),
        "scores": scores.tolist(),
    }


def _space() -> dict[str, Any]:
    return {
        "optimizer": {
            "type": "categorical",
            "choices": OPTIMIZER_CHOICES,
        },
        "lr": {
            "type": "float",
            "low": LR_LOW,
            "high": LR_HIGH,
            "scale": "log",
        },
        "depth": {
            "type": "int",
            "low": DEPTH_LOW,
            "high": DEPTH_HIGH,
            "step": DEPTH_STEP,
        },
    }


def _fixture(generated_at: str, scenario: dict[str, Any]) -> dict[str, Any]:
    below_trials = scenario["below"]
    above_trials = scenario["above"]
    categorical_rolls = scenario["categoricalRolls"]
    float_rolls = _to_roll_pairs(scenario["floatRolls"])
    int_rolls = _to_roll_pairs(scenario["intRolls"])

    below_optimizers = [trial["config"]["optimizer"] for trial in below_trials]
    above_optimizers = [trial["config"]["optimizer"] for trial in above_trials]
    below_lr = [float(trial["config"]["lr"]) for trial in below_trials]
    above_lr = [float(trial["config"]["lr"]) for trial in above_trials]
    below_depth = [int(trial["config"]["depth"]) for trial in below_trials]
    above_depth = [int(trial["config"]["depth"]) for trial in above_trials]

    categorical = _categorical_trace(
        _categorical_estimator(below_optimizers),
        _categorical_estimator(above_optimizers),
        categorical_rolls,
    )
    float_trace = _float_trace(
        _float_estimator(below_lr),
        _float_estimator(above_lr),
        float_rolls,
    )
    int_trace = _int_trace(
        _int_estimator(below_depth),
        _int_estimator(above_depth),
        int_rolls,
    )
    dimensions = [categorical, float_trace, int_trace]
    candidate_count = len(categorical_rolls)

    candidate_configs = [
        {
            "optimizer": categorical["candidates"][index],
            "lr": float_trace["candidates"][index],
            "depth": int_trace["candidates"][index],
        }
        for index in range(candidate_count)
    ]
    joint_scores = [
        float(categorical["scores"][index] + float_trace["scores"][index] + int_trace["scores"][index])
        for index in range(candidate_count)
    ]
    best_index = int(np.argmax(np.asarray(joint_scores, dtype=np.float64)))

    return {
        "fixture": scenario["fixture"],
        "file": scenario["file"],
        "metadata": metadata(generated_at),
        "payload": {
            "space": _space(),
            "sampler": {
                "seed": scenario["seed"],
                "nStartupTrials": 0,
                "nEiCandidates": candidate_count,
                "nextTrialNumber": max(trial["trialNumber"] for trial in below_trials + above_trials) + 1,
            },
            "split": {
                "below": below_trials,
                "above": above_trials,
            },
            "dimensions": dimensions,
            "expected": {
                "candidateConfigs": candidate_configs,
                "jointScores": joint_scores,
                "expectedBestIndex": best_index,
                "expectedSuggestion": candidate_configs[best_index],
            },
        },
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [_fixture(generated_at, scenario) for scenario in SCENARIOS]
