#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "optuna==4.3.0",
#   "numpy>=1.26,<2",
# ]
# [tool.uv]
# exclude-newer = "2026-03-15T00:00:00Z"
# ///
"""Verify committed fixture JSON against live Optuna computation.

Catches two failure modes:
  (a) handcrafted fixture values that were wrong from the start
  (b) drift if Optuna internals change between versions

Requirements: uv (https://docs.astral.sh/uv/)
Usage:        uv run scripts/verify-optuna-fixtures.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

import numpy as np
import optuna
from optuna._hypervolume import compute_hypervolume  # type: ignore[import-untyped]
from optuna.distributions import BaseDistribution, CategoricalDistribution, FloatDistribution
from optuna.search_space.group_decomposed import _SearchSpaceGroup
from optuna.samplers._tpe import _truncnorm
from optuna.samplers._tpe.parzen_estimator import _ParzenEstimator, _ParzenEstimatorParameters
from optuna.samplers._tpe.probability_distributions import (
    _BatchedCategoricalDistributions,
    _BatchedTruncNormDistributions,
)
from optuna.samplers._tpe.sampler import (  # type: ignore[import-untyped]
    _split_complete_trials_multi_objective,
    _split_trials,
    default_gamma,
    default_weights,
    hyperopt_default_gamma,
)
from optuna.trial import TrialState, create_trial

# ---------------------------------------------------------------------------
# Numeric tolerance contracts for fixture verification
# ---------------------------------------------------------------------------
PROB_ABS_TOL = 1e-12
SIGMA_ABS_TOL = 1e-10
LOG_DENSITY_ABS_TOL = 1e-9
TRUNCATED_SAMPLE_ABS_TOL = 1e-10

FIXTURE_DIR = Path("test/fixtures/optuna")
NOISE_FLOOR = 1e-12
NOISE_BOOTSTRAP_REPLICATES = 8
MAX_NOISE_BANDWIDTH_SCALE = 5.0
CONSTRAINED_RATIO_EPSILON = 1e-12
CONSTRAINED_RATIO_MAX = 1.0 / CONSTRAINED_RATIO_EPSILON
CONSTRAINED_BOUNDS_PADDING_RATIO = 0.05


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def load_fixture(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Fixture not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def assert_close(
    actual: float,
    expected: float,
    abs_tol: float,
    context: str,
) -> list[str]:
    if math.isnan(expected) and math.isnan(actual):
        return []
    if math.isinf(expected) and math.isinf(actual) and (expected > 0) == (actual > 0):
        return []
    if abs(actual - expected) > abs_tol:
        return [
            f"  FAIL {context}: expected={expected}, actual={actual}, diff={abs(actual - expected)}, tol={abs_tol}"
        ]
    return []


def assert_exact(actual: Any, expected: Any, context: str) -> list[str]:
    if actual != expected:
        return [f"  FAIL {context}: expected={expected!r}, actual={actual!r}"]
    return []


def parse_roll_pair(roll: Any, context: str) -> tuple[float, float]:
    if isinstance(roll, dict):
        return float(roll["kernelRoll"]), float(roll["valueRoll"])
    if isinstance(roll, list | tuple) and len(roll) == 2:
        return float(roll[0]), float(roll[1])
    raise TypeError(f"{context}: expected candidate roll pair, received {roll!r}")


def to_loss_coordinate(value: float, direction: str) -> float:
    return -value if direction == "maximize" else value


def to_loss_point(point: list[float], directions: list[str]) -> list[float]:
    return [
        to_loss_coordinate(value, directions[index] if index < len(directions) else "minimize")
        for index, value in enumerate(point)
    ]


def parzen_parameters(
    categorical_distance_func: dict[str, Any] | None = None,
) -> _ParzenEstimatorParameters:
    return _ParzenEstimatorParameters(
        True,
        1.0,
        True,
        False,
        default_weights,
        False,
        categorical_distance_func or {},
    )


def pick_index_by_roll(weights: np.ndarray, roll: float) -> int:
    cumulative = np.cumsum(weights)
    if cumulative.size > 0:
        cumulative[-1] = 1.0
    return int(min(np.sum(cumulative < roll), len(weights) - 1))


def distribution_for_name(name: str) -> BaseDistribution:
    if name == "optimizer":
        return CategoricalDistribution(["adam", "sgd"])

    if name == "lr":
        return FloatDistribution(1e-5, 1.0)

    return FloatDistribution(0.0, 1.0)


def canonical_groups(search_spaces: list[dict[str, BaseDistribution]]) -> list[dict[str, Any]]:
    groups = [
        {
            "key": "|".join(sorted(group.keys())),
            "dimensions": sorted(group.keys()),
        }
        for group in search_spaces
    ]
    return sorted(groups, key=lambda group: group["key"])


def _noise_average(values: list[float]) -> float:
    return float(sum(values) / len(values)) if values else 0.0


def _noise_variance(values: list[float]) -> float:
    if len(values) <= 1:
        return 0.0

    mean = _noise_average(values)
    return float(sum((value - mean) ** 2 for value in values) / len(values))


def _noise_span(low: float, high: float) -> float:
    return float(max(high - low, NOISE_FLOOR))


def _noise_bandwidth_from_sample(values: list[float], span: float) -> float:
    if len(values) <= 1:
        return span

    stddev = float(np.sqrt(_noise_variance(values)))
    scott_factor = float(len(values) ** (-0.2))
    return float(max(stddev * scott_factor, NOISE_FLOOR))


def _noise_bootstrap_index(observation_count: int, replicate_index: int, sample_index: int) -> int:
    if observation_count <= 0:
        return 0

    return ((replicate_index + 1) * 17 + (sample_index + 1) * 31) % observation_count


def _noise_bootstrap_sample(observations: list[float], replicate_index: int) -> list[float]:
    return [
        observations[_noise_bootstrap_index(len(observations), replicate_index, sample_index)]
        for sample_index in range(len(observations))
    ]


def _noise_bootstrap_bandwidth_variance(observations: list[float], span: float) -> float:
    if len(observations) <= 1:
        return 0.0

    bandwidths = [
        _noise_bandwidth_from_sample(_noise_bootstrap_sample(observations, replicate_index), span)
        for replicate_index in range(NOISE_BOOTSTRAP_REPLICATES)
    ]
    return _noise_variance(bandwidths)


def _normalized_noise(observations: list[float], low: float, high: float) -> float:
    span = _noise_span(low, high)
    observation_variance = _noise_variance(observations)
    bootstrap_variance = _noise_bootstrap_bandwidth_variance(observations, span)
    return float((observation_variance + bootstrap_variance) / (span * span))


def _noise_bandwidth_scale(normalized_noise: float, alpha: float) -> float:
    return float(min(max(1 + max(alpha, 0.0) * normalized_noise, 1.0), MAX_NOISE_BANDWIDTH_SCALE))


def _clip_noise_sigma(sigma: float, low: float, high: float, n_kernels: int) -> float:
    max_sigma = high - low
    min_sigma = (high - low) / min(100, 1 + n_kernels)
    return float(min(max(sigma, min_sigma), max_sigma))


def _constraint_finite_or_infinity(value: float) -> float:
    return float(value) if np.isfinite(value) else float("inf")


def _constraint_value_at(values: list[float], index: int) -> float:
    if index < len(values):
        return _constraint_finite_or_infinity(float(values[index]))

    return float("inf")


def _constraint_dimension_count(observations: list[list[float]]) -> int:
    return max((len(observation) for observation in observations), default=0)


def _constraint_values_for_dimension(observations: list[list[float]], index: int) -> list[float]:
    return [_constraint_value_at(observation, index) for observation in observations]


def _constraint_bounds(values: list[float]) -> tuple[float, float]:
    finite_values = [value for value in values if np.isfinite(value)]
    if not finite_values:
        return -1.0, 1.0

    minimum = min(finite_values)
    maximum = max(finite_values)
    span = maximum - minimum
    padding = 1.0 if span <= 0 else max(1.0, span * CONSTRAINED_BOUNDS_PADDING_RATIO)
    return minimum - padding, maximum + padding


def _constraint_stabilize_ratio(value: float) -> float:
    if np.isfinite(value):
        return float(min(max(value, CONSTRAINED_RATIO_EPSILON), CONSTRAINED_RATIO_MAX))

    return CONSTRAINED_RATIO_MAX if value > 0 else CONSTRAINED_RATIO_EPSILON


def _constraint_is_feasible(value: float) -> bool:
    return _constraint_finite_or_infinity(value) <= 0


def _constraint_gamma(values: list[float]) -> float:
    if not values:
        return 0.5

    feasible_count = sum(1 for value in values if _constraint_is_feasible(value))
    ratio = feasible_count / len(values)
    return float(min(max(ratio, CONSTRAINED_RATIO_EPSILON), 1.0 - CONSTRAINED_RATIO_EPSILON))


def _constraint_log_density(values: list[float], probe: float, low: float, high: float) -> float:
    estimator = _ParzenEstimator(
        {"x": np.asarray(values, dtype=np.float64)},
        {"x": FloatDistribution(low=low, high=high)},
        parzen_parameters(),
    )
    return float(estimator.log_pdf({"x": np.asarray([probe], dtype=np.float64)})[0])


def _constraint_ratio(values: list[float], probe: float) -> float:
    feasible = [value for value in values if _constraint_is_feasible(value)]
    infeasible = [value for value in values if not _constraint_is_feasible(value)]

    if not feasible or not infeasible:
        return 1.0

    low, high = _constraint_bounds(values)
    log_l = _constraint_log_density(feasible, probe, low, high)
    log_g = _constraint_log_density(infeasible, probe, low, high)
    ratio = _constraint_stabilize_ratio(float(np.exp(log_l - log_g)))
    gamma = _constraint_gamma(values)
    denominator = gamma * ratio + (1.0 - gamma)

    if np.isfinite(denominator) and denominator > 0:
        return _constraint_stabilize_ratio(ratio / denominator)

    return CONSTRAINED_RATIO_EPSILON


def _constraint_ratio_product(observations: list[list[float]], probe: list[float]) -> float:
    dimension_count = _constraint_dimension_count(observations)
    ratios = [
        _constraint_ratio(
            _constraint_values_for_dimension(observations, index),
            _constraint_value_at(probe, index),
        )
        for index in range(dimension_count)
    ]
    return float(np.exp(sum(np.log(ratio) for ratio in ratios)))


def _constraint_descending_order(values: list[float]) -> list[int]:
    return [entry[0] for entry in sorted(enumerate(values), key=lambda entry: (-entry[1], entry[0]))]


def _is_finite_number(value: Any) -> bool:
    return isinstance(value, int | float) and math.isfinite(float(value))


def _assert_finite(value: Any, context: str) -> list[str]:
    if not _is_finite_number(value):
        return [f"  FAIL {context}: expected finite numeric value, actual={value!r}"]
    return []


def _assert_within_bounds(value: Any, low: Any, high: Any, context: str) -> list[str]:
    errors: list[str] = []
    errors.extend(_assert_finite(value, context))
    errors.extend(_assert_finite(low, f"{context} low"))
    errors.extend(_assert_finite(high, f"{context} high"))
    if errors:
        return errors

    numeric_value = float(value)
    numeric_low = float(low)
    numeric_high = float(high)
    if numeric_value < numeric_low or numeric_value > numeric_high:
        return [
            f"  FAIL {context}: expected {numeric_low} <= value <= {numeric_high}, actual={numeric_value}"
        ]
    return []


# ---------------------------------------------------------------------------
# FM-1: gamma
# ---------------------------------------------------------------------------
def verify_gamma() -> list[str]:
    doc = load_fixture(FIXTURE_DIR / "gamma/default-gamma.json")
    errors: list[str] = []

    for case in doc["payload"]["cases"]:
        n = case["nTrials"]
        errors.extend(assert_exact(case["defaultGamma"], default_gamma(n), f"gamma default n={n}"))
        errors.extend(assert_exact(case["hyperoptGamma"], hyperopt_default_gamma(n), f"gamma hyperopt n={n}"))

    return errors


# ---------------------------------------------------------------------------
# FM-7: categorical Parzen
# ---------------------------------------------------------------------------
def verify_categorical_parzen() -> list[str]:
    errors: list[str] = []
    fixture_paths = sorted((FIXTURE_DIR / "categorical-parzen").glob("*.json"))

    if not fixture_paths:
        return ["  FAIL categorical-parzen: no fixture files found"]

    for fixture_path in fixture_paths:
        doc = load_fixture(fixture_path)
        payload = doc["payload"]
        fixture_name = doc["fixture"]
        choices = payload["choices"]
        observations = payload["observations"]
        observations_indices = np.asarray([choices.index(value) for value in observations], dtype=np.float64)
        search_space = {"choice": CategoricalDistribution(choices)}
        distance_metric = payload.get("distanceMetric")
        distance = (
            {"choice": lambda left, right: abs(float(left) - float(right))}
            if distance_metric == "absolute"
            else None
        )
        estimator = _ParzenEstimator(
            {"choice": observations_indices},
            search_space,
            parzen_parameters(distance),
        )
        mixture = estimator._mixture_distribution
        distribution = mixture.distributions[0]

        if not isinstance(distribution, _BatchedCategoricalDistributions):
            errors.append(f"  FAIL {fixture_name}: expected categorical batched distribution")
            continue

        expected = payload["expected"]
        expected_kernel_weights = expected["kernelWeights"]
        expected_kernels = expected["kernels"]
        expected_probabilities = expected["probabilities"]

        for index, weight in enumerate(expected_kernel_weights):
            actual_weight = float(mixture.weights[index])
            errors.extend(assert_close(actual_weight, weight, PROB_ABS_TOL, f"{fixture_name} kernelWeight[{index}]"))

        for kernel_index, expected_kernel in enumerate(expected_kernels):
            for value_index, value in enumerate(expected_kernel):
                actual_value = float(distribution.weights[kernel_index, value_index])
                errors.extend(
                    assert_close(actual_value, value, PROB_ABS_TOL, f"{fixture_name} kernel[{kernel_index}][{value_index}]")
                )

        actual_probabilities = np.sum(mixture.weights[:, np.newaxis] * distribution.weights, axis=0)
        for index, expected_probability in enumerate(expected_probabilities):
            actual_probability = float(actual_probabilities[index])
            errors.extend(
                assert_close(actual_probability, expected_probability, PROB_ABS_TOL, f"{fixture_name} probability[{index}]")
            )

        rolls = expected["candidateRolls"]
        expected_candidates = expected["expectedCandidates"]
        predicted_candidates = [
            choices[pick_index_by_roll(actual_probabilities, roll)]
            for roll in rolls
        ]
        errors.extend(assert_exact(predicted_candidates, expected_candidates, f"{fixture_name} candidate rolls"))

    return errors


# ---------------------------------------------------------------------------
# FM-8: continuous KDE
# ---------------------------------------------------------------------------
def verify_continuous_kde() -> list[str]:
    errors: list[str] = []
    fixture_paths = sorted((FIXTURE_DIR / "continuous-kde").glob("*.json"))

    if not fixture_paths:
        return ["  FAIL continuous-kde: no fixture files found"]

    for fixture_path in fixture_paths:
        doc = load_fixture(fixture_path)
        payload = doc["payload"]
        fixture_name = doc["fixture"]
        observations = np.asarray(payload["observations"], dtype=np.float64)
        low = float(payload["low"])
        high = float(payload["high"])
        estimator = _ParzenEstimator(
            {"x": observations},
            {"x": FloatDistribution(low=low, high=high)},
            parzen_parameters(),
        )
        mixture = estimator._mixture_distribution
        distribution = mixture.distributions[0]

        if not isinstance(distribution, _BatchedTruncNormDistributions):
            errors.append(f"  FAIL {fixture_name}: expected truncnorm batched distribution")
            continue

        expected = payload["expected"]

        for index, expected_kernel in enumerate(expected["kernels"]):
            errors.extend(
                assert_close(
                    float(distribution.mu[index]),
                    expected_kernel["mean"],
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} kernel[{index}].mean",
                )
            )
            errors.extend(
                assert_close(
                    float(distribution.sigma[index]),
                    expected_kernel["sigma"],
                    SIGMA_ABS_TOL,
                    f"{fixture_name} kernel[{index}].sigma",
                )
            )
            errors.extend(
                assert_close(
                    float(mixture.weights[index]),
                    expected_kernel["weight"],
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} kernel[{index}].weight",
                )
            )

        for trace in expected["logDensities"]:
            probe = float(trace["probe"])
            expected_log_density = float(trace["expected"])
            actual_log_density = float(estimator.log_pdf({"x": np.asarray([probe], dtype=np.float64)})[0])
            errors.extend(
                assert_close(
                    actual_log_density,
                    expected_log_density,
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} logDensity({probe})",
                )
            )

        for index, roll in enumerate(expected["candidateRolls"]):
            kernel_roll, value_roll = parse_roll_pair(roll, f"{fixture_name} candidateRolls[{index}]")
            selected = pick_index_by_roll(mixture.weights, kernel_roll)
            mu = float(distribution.mu[selected])
            sigma = float(distribution.sigma[selected])
            a = (distribution.low - mu) / sigma
            b = (distribution.high - mu) / sigma
            quantile = _truncnorm.ppf(
                np.asarray([value_roll], dtype=np.float64),
                np.asarray([a]),
                np.asarray([b]),
            )
            sample = float(quantile[0] * sigma + mu)
            errors.extend(
                assert_close(
                    sample,
                    float(expected["expectedSamples"][index]),
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} sample[{index}]",
                )
            )

    return errors


# ---------------------------------------------------------------------------
# FM-15: noise-aware bandwidth
# ---------------------------------------------------------------------------
def verify_noise_bandwidth() -> list[str]:
    doc = load_fixture(FIXTURE_DIR / "noise-bandwidth/parity.json")
    payload = doc["payload"]
    errors: list[str] = []

    for case in payload["cases"]:
        case_id = case["id"]
        observations = [float(value) for value in case["observations"]]
        low = float(case["low"])
        high = float(case["high"])
        alpha = float(case["alpha"])
        expected = case["expected"]

        estimator = _ParzenEstimator(
            {"x": np.asarray(observations, dtype=np.float64)},
            {"x": FloatDistribution(low=low, high=high)},
            parzen_parameters(),
        )
        distribution = estimator._mixture_distribution.distributions[0]

        if not isinstance(distribution, _BatchedTruncNormDistributions):
            errors.append(f"  FAIL noise-bandwidth[{case_id}]: expected truncnorm batched distribution")
            continue

        base_sigmas = [float(value) for value in distribution.sigma]

        for index, expected_sigma in enumerate(expected["baseSigmas"]):
            errors.extend(
                assert_close(
                    base_sigmas[index],
                    float(expected_sigma),
                    SIGMA_ABS_TOL,
                    f"noise-bandwidth[{case_id}] baseSigmas[{index}]",
                )
            )

        normalized_noise = _normalized_noise(observations, low, high)
        errors.extend(
            assert_close(
                normalized_noise,
                float(expected["normalizedNoise"]),
                LOG_DENSITY_ABS_TOL,
                f"noise-bandwidth[{case_id}] normalizedNoise",
            )
        )

        scale = _noise_bandwidth_scale(normalized_noise, alpha)
        errors.extend(
            assert_close(
                scale,
                float(expected["bandwidthScale"]),
                LOG_DENSITY_ABS_TOL,
                f"noise-bandwidth[{case_id}] bandwidthScale",
            )
        )

        adjusted_sigmas = [
            _clip_noise_sigma(sigma * scale, low, high, len(base_sigmas))
            for sigma in base_sigmas
        ]

        for index, expected_sigma in enumerate(expected["adjustedSigmas"]):
            errors.extend(
                assert_close(
                    adjusted_sigmas[index],
                    float(expected_sigma),
                    SIGMA_ABS_TOL,
                    f"noise-bandwidth[{case_id}] adjustedSigmas[{index}]",
                )
            )

    return errors


def _truncated_normal_cdf(
    probe: float,
    mean: float,
    sigma: float,
    low: float,
    high: float,
    standardized_low: float,
    standardized_high: float,
) -> float:
    if probe <= low:
        return 0.0
    if probe >= high:
        return 1.0

    standardized_probe = (probe - mean) / sigma
    numerator = float(
        _truncnorm._log_gauss_mass(  # pyright: ignore[reportPrivateUsage]
            np.asarray([standardized_low], dtype=np.float64),
            np.asarray([standardized_probe], dtype=np.float64),
        )[0]
    )
    denominator = float(
        _truncnorm._log_gauss_mass(  # pyright: ignore[reportPrivateUsage]
            np.asarray([standardized_low], dtype=np.float64),
            np.asarray([standardized_high], dtype=np.float64),
        )[0]
    )
    return float(min(max(math.exp(numerator - denominator), 0.0), 1.0))


def verify_truncated_normal() -> list[str]:
    doc = load_fixture(FIXTURE_DIR / "truncated-normal/edge-cases.json")
    payload = doc["payload"]
    errors: list[str] = []

    for case in payload["cases"]:
        case_id = str(case["id"])
        params = case["params"]
        mean = float(params["mean"])
        sigma = float(params["sigma"])
        low = float(params["low"])
        high = float(params["high"])
        standardized_low = (low - mean) / sigma
        standardized_high = (high - mean) / sigma

        quantiles = np.asarray(case["sampleQuantiles"], dtype=np.float64)
        sampled = _truncnorm.ppf(
            quantiles,
            np.asarray([standardized_low], dtype=np.float64),
            np.asarray([standardized_high], dtype=np.float64),
        )
        sampled = np.clip(sampled * sigma + mean, low, high)

        for index, expected in enumerate(case["sampleExpected"]):
            errors.extend(
                assert_close(
                    float(sampled[index]),
                    float(expected),
                    TRUNCATED_SAMPLE_ABS_TOL,
                    f"truncated-normal sample {case_id}[{index}]",
                )
            )

        for index, probe in enumerate(case["cdfProbes"]):
            actual_cdf = _truncated_normal_cdf(
                float(probe),
                mean,
                sigma,
                low,
                high,
                standardized_low,
                standardized_high,
            )
            errors.extend(
                assert_close(
                    actual_cdf,
                    float(case["cdfExpected"][index]),
                    PROB_ABS_TOL,
                    f"truncated-normal cdf {case_id}[{index}]",
                )
            )

        log_pdf = _truncnorm.logpdf(
            np.asarray(case["logPdfProbes"], dtype=np.float64),
            standardized_low,
            standardized_high,
            loc=mean,
            scale=sigma,
        )
        for index, expected in enumerate(case["logPdfExpected"]):
            errors.extend(
                assert_close(
                    float(log_pdf[index]),
                    float(expected),
                    LOG_DENSITY_ABS_TOL,
                    f"truncated-normal logPdf {case_id}[{index}]",
                )
            )

    return errors


# ---------------------------------------------------------------------------
# FM-9: EI scoring
# ---------------------------------------------------------------------------
def verify_ei() -> list[str]:
    errors: list[str] = []
    fixture_paths = sorted((FIXTURE_DIR / "ei").glob("*.json"))

    if not fixture_paths:
        return ["  FAIL ei: no fixture files found"]

    for fixture_path in fixture_paths:
        doc = load_fixture(fixture_path)
        payload = doc["payload"]
        fixture_name = doc["fixture"]
        trace_scores = []

        for index, trace in enumerate(payload["scoreTrace"]):
            expected_score = float(trace["logL"]) - float(trace["logG"])
            trace_scores.append(expected_score)
            errors.extend(
                assert_close(
                    float(trace["expected"]),
                    expected_score,
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} trace[{index}]",
                )
            )

        errors.extend(assert_exact(payload["scoreVector"], trace_scores, f"{fixture_name} scoreVector"))
        errors.extend(assert_exact(payload["expectedBestIndex"], int(np.argmax(trace_scores)), f"{fixture_name} argmax"))

    return errors


def _categorical_probabilities(estimator: _ParzenEstimator) -> np.ndarray:
    mixture = estimator._mixture_distribution
    distribution = mixture.distributions[0]

    if not isinstance(distribution, _BatchedCategoricalDistributions):
        raise TypeError("expected categorical batched distribution")

    probabilities = np.sum(mixture.weights[:, np.newaxis] * distribution.weights, axis=0)
    return probabilities.astype(np.float64)


def _safe_log(value: float) -> float:
    return float(np.log(value)) if value > 0 else float("-inf")


def _fixture_float(value: Any) -> float:
    if isinstance(value, str) and value == "NaN":
        return float("nan")

    return float(value)


def _fixture_trial_state(value: str) -> TrialState:
    normalized = value.lower()

    if normalized == "complete":
        return TrialState.COMPLETE
    if normalized == "pruned":
        return TrialState.PRUNED
    if normalized == "running":
        return TrialState.RUNNING

    raise ValueError(f"unsupported trial state: {value}")


def verify_split_trials() -> list[str]:
    doc = load_fixture(FIXTURE_DIR / "split-trials/single-and-liar.json")
    payload = doc["payload"]
    errors: list[str] = []

    for case in payload["cases"]:
        study = optuna.create_study(direction=case["direction"])
        trials = []

        for trial_payload in case["trials"]:
            state = _fixture_trial_state(trial_payload["state"])
            value = _fixture_float(trial_payload["value"]) if "value" in trial_payload else None
            intermediate_values = {
                int(entry["step"]): _fixture_float(entry["value"])
                for entry in trial_payload["intermediateValues"]
            }

            trial = create_trial(
                state=state,
                value=value if state != TrialState.RUNNING else None,
                params={},
                distributions={},
                intermediate_values=intermediate_values,
            )
            trial._number = int(trial_payload["trialNumber"])
            trials.append(trial)

        below_trials, above_trials = _split_trials(
            study,
            trials,
            int(case["nBelow"]),
            constraints_enabled=False,
        )
        actual_below = [trial.number for trial in below_trials]
        actual_above = [trial.number for trial in above_trials]

        split_below_repeat, split_above_repeat = _split_trials(
            study,
            trials,
            int(case["nBelow"]),
            constraints_enabled=False,
        )
        repeat_below = [trial.number for trial in split_below_repeat]
        repeat_above = [trial.number for trial in split_above_repeat]

        input_numbers = sorted(int(trial["trialNumber"]) for trial in case["trials"])
        running_numbers = sorted(
            int(trial["trialNumber"])
            for trial in case["trials"]
            if _fixture_trial_state(trial["state"]) == TrialState.RUNNING
        )
        non_running_count = len(case["trials"]) - len(running_numbers)
        expected_below_size = min(int(case["nBelow"]), non_running_count)

        errors.extend(assert_exact(sorted(actual_below + actual_above), input_numbers, f"fm2 partition {case['id']}"))
        errors.extend(assert_exact(len(actual_below), expected_below_size, f"fm2 nBelow {case['id']}"))
        errors.extend(
            assert_exact(
                sorted(number for number in actual_above if number in running_numbers),
                running_numbers,
                f"fm2 running-in-above {case['id']}",
            )
        )
        errors.extend(assert_exact(actual_below, repeat_below, f"fm2 deterministic below {case['id']}"))
        errors.extend(assert_exact(actual_above, repeat_above, f"fm2 deterministic above {case['id']}"))

    return errors


def verify_constrained_tpe() -> list[str]:
    doc = load_fixture(FIXTURE_DIR / "constrained-tpe/parity.json")
    payload = doc["payload"]
    errors: list[str] = []

    for density_case in payload["densityCases"]:
        case_id = density_case["id"]
        observations = [
            [float(value) for value in vector]
            for vector in density_case["observations"]
        ]
        probes = [
            [float(value) for value in vector]
            for vector in density_case["probes"]
        ]
        expected_ratios = [float(value) for value in density_case["expectedRatioProducts"]]
        actual_ratios = [_constraint_ratio_product(observations, probe) for probe in probes]

        for index, expected_ratio in enumerate(expected_ratios):
            errors.extend(
                assert_close(
                    actual_ratios[index],
                    expected_ratio,
                    LOG_DENSITY_ABS_TOL,
                    f"constrained density {case_id} ratio[{index}]",
                )
            )

        expected_order = [int(value) for value in density_case["expectedOrder"]]
        errors.extend(
            assert_exact(
                _constraint_descending_order(actual_ratios),
                expected_order,
                f"constrained density {case_id} order",
            )
        )

    split_case = payload["splitCase"]
    study = optuna.create_study(direction=split_case["direction"])
    trials = []

    for trial_payload in split_case["trials"]:
        trial = create_trial(
            state=TrialState.COMPLETE,
            value=float(trial_payload["value"]),
            params={},
            distributions={},
            system_attrs={
                "constraints": [float(value) for value in trial_payload["constraints"]],
            },
        )
        trial._number = int(trial_payload["trialNumber"])
        trials.append(trial)

    below, above = _split_trials(study, trials, int(split_case["nBelow"]), constraints_enabled=True)
    actual_below = [trial.number for trial in below]
    actual_above = [trial.number for trial in above]

    errors.extend(assert_exact(actual_below, split_case["expectedBelow"], "constrained split below"))
    errors.extend(assert_exact(actual_above, split_case["expectedAbove"], "constrained split above"))

    return errors


def verify_motpe_split() -> list[str]:
    doc = load_fixture(FIXTURE_DIR / "motpe-split/multi-rank-hssp.json")
    payload = doc["payload"]
    study = optuna.create_study(directions=payload["directions"])
    trials = []

    for trial_payload in payload["trials"]:
        trial = create_trial(
            state=TrialState.COMPLETE,
            values=[float(value) for value in trial_payload["values"]],
            params={},
            distributions={},
        )
        trial._number = int(trial_payload["trialNumber"])
        trials.append(trial)

    below_trials, above_trials = _split_complete_trials_multi_objective(
        trials,
        study,
        int(payload["nBelow"]),
    )
    repeated_below_trials, repeated_above_trials = _split_complete_trials_multi_objective(
        trials,
        study,
        int(payload["nBelow"]),
    )
    actual_below = [trial.number for trial in below_trials]
    actual_above = [trial.number for trial in above_trials]
    repeated_below = [trial.number for trial in repeated_below_trials]
    repeated_above = [trial.number for trial in repeated_above_trials]

    trial_numbers = sorted(int(trial["trialNumber"]) for trial in payload["trials"])
    rank_by_trial = {int(trial["trialNumber"]): int(trial["rank"]) for trial in payload["trials"]}
    max_selected_rank = max(rank_by_trial[number] for number in actual_below)
    lower_rank_trials = sorted(
        number
        for number, rank in rank_by_trial.items()
        if rank < max_selected_rank
    )
    selected_lower_rank_trials = sorted(
        number
        for number in actual_below
        if rank_by_trial[number] < max_selected_rank
    )

    errors: list[str] = []
    errors.extend(assert_exact(sorted(actual_below + actual_above), trial_numbers, "fm4 partition"))
    errors.extend(assert_exact(len(actual_below), int(payload["nBelow"]), "fm4 nBelow"))
    errors.extend(assert_exact(actual_below, repeated_below, "fm4 deterministic below"))
    errors.extend(assert_exact(actual_above, repeated_above, "fm4 deterministic above"))
    errors.extend(assert_exact(selected_lower_rank_trials, lower_rank_trials, "fm4 rank-boundary lower ranks"))
    return errors


def verify_mixed_space_joint_trace() -> list[str]:
    errors: list[str] = []
    fixture_paths = sorted((FIXTURE_DIR / "mixed-space").glob("*.json"))

    if not fixture_paths:
        return ["  FAIL mixed-space: no fixture files found"]

    optimizer_choices = ["adam", "sgd", "adamw"]

    for fixture_path in fixture_paths:
        doc = load_fixture(fixture_path)
        payload = doc["payload"]
        fixture_name = doc["fixture"]

        below_trials = payload["split"]["below"]
        above_trials = payload["split"]["above"]
        dimension_entries = {entry["name"]: entry for entry in payload["dimensions"]}
        categorical_entry = dimension_entries["optimizer"]
        float_entry = dimension_entries["lr"]
        int_entry = dimension_entries["depth"]

        below_optimizer = [trial["config"]["optimizer"] for trial in below_trials]
        above_optimizer = [trial["config"]["optimizer"] for trial in above_trials]
        below_lr = [float(trial["config"]["lr"]) for trial in below_trials]
        above_lr = [float(trial["config"]["lr"]) for trial in above_trials]
        below_depth = [int(trial["config"]["depth"]) for trial in below_trials]
        above_depth = [int(trial["config"]["depth"]) for trial in above_trials]

        optimizer_space = {"optimizer": CategoricalDistribution(optimizer_choices)}
        below_optimizer_estimator = _ParzenEstimator(
            {"optimizer": np.asarray([optimizer_choices.index(value) for value in below_optimizer], dtype=np.float64)},
            optimizer_space,
            parzen_parameters(),
        )
        above_optimizer_estimator = _ParzenEstimator(
            {"optimizer": np.asarray([optimizer_choices.index(value) for value in above_optimizer], dtype=np.float64)},
            optimizer_space,
            parzen_parameters(),
        )
        below_optimizer_probabilities = _categorical_probabilities(below_optimizer_estimator)
        above_optimizer_probabilities = _categorical_probabilities(above_optimizer_estimator)
        expected_optimizer_candidates = [
            optimizer_choices[pick_index_by_roll(below_optimizer_probabilities, roll)]
            for roll in categorical_entry["candidateRolls"]
        ]

        errors.extend(
            assert_exact(
                categorical_entry["candidates"],
                expected_optimizer_candidates,
                f"{fixture_name} optimizer candidates",
            )
        )

        optimizer_scores: list[float] = []
        for index, candidate in enumerate(expected_optimizer_candidates):
            choice_index = optimizer_choices.index(candidate)
            log_l = _safe_log(float(below_optimizer_probabilities[choice_index]))
            log_g = _safe_log(float(above_optimizer_probabilities[choice_index]))
            score = log_l - log_g
            optimizer_scores.append(score)
            errors.extend(
                assert_close(
                    float(categorical_entry["logL"][index]),
                    log_l,
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} optimizer logL[{index}]",
                )
            )
            errors.extend(
                assert_close(
                    float(categorical_entry["logG"][index]),
                    log_g,
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} optimizer logG[{index}]",
                )
            )
            errors.extend(
                assert_close(
                    float(categorical_entry["scores"][index]),
                    score,
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} optimizer score[{index}]",
                )
            )

        float_space = {"lr": FloatDistribution(low=0.0005, high=0.2, log=True)}
        below_float_estimator = _ParzenEstimator(
            {"lr": np.asarray(below_lr, dtype=np.float64)},
            float_space,
            parzen_parameters(),
        )
        above_float_estimator = _ParzenEstimator(
            {"lr": np.asarray(above_lr, dtype=np.float64)},
            float_space,
            parzen_parameters(),
        )
        below_float_distribution = below_float_estimator._mixture_distribution.distributions[0]
        if not isinstance(below_float_distribution, _BatchedTruncNormDistributions):
            errors.append(f"  FAIL {fixture_name}: float trace expected batched truncnorm distribution")
            continue

        float_candidates: list[float] = []
        for roll_index, roll in enumerate(float_entry["candidateRolls"]):
            kernel_roll, value_roll = parse_roll_pair(roll, f"{fixture_name} float candidateRolls[{roll_index}]")
            component_index = pick_index_by_roll(below_float_estimator._mixture_distribution.weights, kernel_roll)
            mu = float(below_float_distribution.mu[component_index])
            sigma = float(below_float_distribution.sigma[component_index])
            a = (below_float_distribution.low - mu) / sigma
            b = (below_float_distribution.high - mu) / sigma
            quantile = _truncnorm.ppf(
                np.asarray([value_roll], dtype=np.float64),
                np.asarray([a]),
                np.asarray([b]),
            )
            sample = float(np.exp(float(quantile[0] * sigma + mu)))
            float_candidates.append(sample)

        for index, candidate in enumerate(float_candidates):
            errors.extend(
                assert_close(
                    float(float_entry["candidates"][index]),
                    candidate,
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} float candidate[{index}]",
                )
            )

        float_log_l = below_float_estimator.log_pdf({"lr": np.asarray(float_candidates, dtype=np.float64)})
        float_log_g = above_float_estimator.log_pdf({"lr": np.asarray(float_candidates, dtype=np.float64)})
        float_scores = float_log_l - float_log_g
        for index in range(len(float_candidates)):
            errors.extend(
                assert_close(
                    float(float_entry["logL"][index]),
                    float(float_log_l[index]),
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} float logL[{index}]",
                )
            )
            errors.extend(
                assert_close(
                    float(float_entry["logG"][index]),
                    float(float_log_g[index]),
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} float logG[{index}]",
                )
            )
            errors.extend(
                assert_close(
                    float(float_entry["scores"][index]),
                    float(float_scores[index]),
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} float score[{index}]",
                )
            )

        depth_space = {"depth": FloatDistribution(low=0.5, high=8.5)}
        below_int_estimator = _ParzenEstimator(
            {"depth": np.asarray(below_depth, dtype=np.float64)},
            depth_space,
            parzen_parameters(),
        )
        above_int_estimator = _ParzenEstimator(
            {"depth": np.asarray(above_depth, dtype=np.float64)},
            depth_space,
            parzen_parameters(),
        )
        below_int_distribution = below_int_estimator._mixture_distribution.distributions[0]
        if not isinstance(below_int_distribution, _BatchedTruncNormDistributions):
            errors.append(f"  FAIL {fixture_name}: int trace expected batched truncnorm distribution")
            continue

        int_model_candidates: list[float] = []
        int_candidates: list[int] = []
        for roll_index, roll in enumerate(int_entry["candidateRolls"]):
            kernel_roll, value_roll = parse_roll_pair(roll, f"{fixture_name} int candidateRolls[{roll_index}]")
            component_index = pick_index_by_roll(below_int_estimator._mixture_distribution.weights, kernel_roll)
            mu = float(below_int_distribution.mu[component_index])
            sigma = float(below_int_distribution.sigma[component_index])
            a = (below_int_distribution.low - mu) / sigma
            b = (below_int_distribution.high - mu) / sigma
            quantile = _truncnorm.ppf(
                np.asarray([value_roll], dtype=np.float64),
                np.asarray([a]),
                np.asarray([b]),
            )
            sampled = float(quantile[0] * sigma + mu)
            int_model_candidates.append(sampled)
            candidate = int(np.clip(1 + np.round(sampled - 1), 1, 8))
            int_candidates.append(candidate)

        errors.extend(assert_exact(int_entry["candidates"], int_candidates, f"{fixture_name} int candidates"))

        int_log_l = below_int_estimator.log_pdf({"depth": np.asarray(int_model_candidates, dtype=np.float64)})
        int_log_g = above_int_estimator.log_pdf({"depth": np.asarray(int_model_candidates, dtype=np.float64)})
        int_scores = int_log_l - int_log_g
        for index in range(len(int_candidates)):
            errors.extend(
                assert_close(
                    float(int_entry["logL"][index]),
                    float(int_log_l[index]),
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} int logL[{index}]",
                )
            )
            errors.extend(
                assert_close(
                    float(int_entry["logG"][index]),
                    float(int_log_g[index]),
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} int logG[{index}]",
                )
            )
            errors.extend(
                assert_close(
                    float(int_entry["scores"][index]),
                    float(int_scores[index]),
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} int score[{index}]",
                )
            )

        candidate_configs = [
            {
                "optimizer": expected_optimizer_candidates[index],
                "lr": float_candidates[index],
                "depth": int_candidates[index],
            }
            for index in range(len(expected_optimizer_candidates))
        ]
        expected_payload = payload["expected"]
        for index, candidate in enumerate(candidate_configs):
            fixture_candidate = expected_payload["candidateConfigs"][index]
            errors.extend(
                assert_exact(
                    fixture_candidate["optimizer"],
                    candidate["optimizer"],
                    f"{fixture_name} candidate optimizer[{index}]",
                )
            )
            errors.extend(
                assert_close(
                    float(fixture_candidate["lr"]),
                    float(candidate["lr"]),
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} candidate lr[{index}]",
                )
            )
            errors.extend(
                assert_exact(
                    fixture_candidate["depth"],
                    candidate["depth"],
                    f"{fixture_name} candidate depth[{index}]",
                )
            )

        joint_scores = [
            float(optimizer_scores[index] + float_scores[index] + int_scores[index])
            for index in range(len(candidate_configs))
        ]
        for index, score in enumerate(joint_scores):
            errors.extend(
                assert_close(
                    float(expected_payload["jointScores"][index]),
                    score,
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} joint score[{index}]",
                )
            )

        best_index = int(np.argmax(np.asarray(joint_scores, dtype=np.float64)))
        errors.extend(assert_exact(expected_payload["expectedBestIndex"], best_index, f"{fixture_name} best index"))
        errors.extend(
            assert_exact(
                expected_payload["expectedSuggestion"]["optimizer"],
                candidate_configs[best_index]["optimizer"],
                f"{fixture_name} expected suggestion optimizer",
            )
        )
        errors.extend(
            assert_close(
                float(expected_payload["expectedSuggestion"]["lr"]),
                float(candidate_configs[best_index]["lr"]),
                LOG_DENSITY_ABS_TOL,
                f"{fixture_name} expected suggestion lr",
            )
        )
        errors.extend(
            assert_exact(
                expected_payload["expectedSuggestion"]["depth"],
                candidate_configs[best_index]["depth"],
                f"{fixture_name} expected suggestion depth",
            )
        )

    return errors


def verify_multivariate_gaussian() -> list[str]:
    doc = load_fixture(FIXTURE_DIR / "multivariate-gaussian/parity.json")
    payload = doc["payload"]
    errors: list[str] = []

    def diagonal_log_density(point: list[float], mean: list[float], sigmas: list[float]) -> float:
        if len(point) != len(mean) or len(mean) != len(sigmas):
            return float("-inf")

        total = 0.0
        for coordinate, current_mean, sigma in zip(point, mean, sigmas, strict=False):
            clamped_sigma = sigma if np.isfinite(sigma) and sigma > 0 else 1e-12
            normalized = (coordinate - current_mean) / clamped_sigma
            total += -0.5 * np.log(2 * np.pi) - np.log(clamped_sigma) - 0.5 * normalized * normalized

        return float(total)

    def sample_diagonal(mean: list[float], sigmas: list[float], rolls: list[float]) -> list[float]:
        quantiles = _truncnorm._ndtri_exp(np.log(np.asarray(rolls, dtype=np.float64)))  # pyright: ignore[reportPrivateUsage]
        return [
            float(current_mean + sigma * quantile)
            for current_mean, sigma, quantile in zip(mean, sigmas, quantiles.tolist(), strict=False)
        ]

    def mixture_log_density(
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
            np.log(weight) + diagonal_log_density(point, mean, sigma)
            for mean, sigma, weight in zip(means, sigmas, normalized_weights, strict=False)
            if weight > 0
        ]

        if len(component_log_densities) <= 0:
            return float("-inf")

        max_value = max(component_log_densities)
        return float(max_value + np.log(sum(np.exp(value - max_value) for value in component_log_densities)))

    for case in payload["densityCases"]:
        actual = diagonal_log_density(case["point"], case["mean"], case["sigmas"])
        errors.extend(
            assert_close(
                actual,
                float(case["expectedLogDensity"]),
                LOG_DENSITY_ABS_TOL,
                f"fm14 density {case['id']}",
            )
        )

    for case in payload["bandwidthCases"]:
        factor = 1.0
        if case["sampleCount"] > 0 and case["dimensions"] > 0:
            factor = float(case["sampleCount"] ** (-1 / (case["dimensions"] + 4)))
        stddev = float(case["stddev"])
        clamped_stddev = stddev if np.isfinite(stddev) and stddev > 0 else 1e-12
        bandwidth = clamped_stddev * factor
        errors.extend(
            assert_close(
                factor,
                float(case["expectedFactor"]),
                LOG_DENSITY_ABS_TOL,
                f"fm14 factor {case['id']}",
            )
        )
        errors.extend(
            assert_close(
                bandwidth,
                float(case["expectedBandwidth"]),
                LOG_DENSITY_ABS_TOL,
                f"fm14 bandwidth {case['id']}",
            )
        )

    for case in payload["samplingCases"]:
        actual_sample = sample_diagonal(case["mean"], case["sigmas"], case["rolls"])
        for index, actual_value in enumerate(actual_sample):
            errors.extend(
                assert_close(
                    actual_value,
                    float(case["expectedSample"][index]),
                    LOG_DENSITY_ABS_TOL,
                    f"fm14 sample {case['id']}[{index}]",
                )
            )

    mixture_case = payload["mixtureCase"]
    weights = [max(float(weight), 0.0) for weight in mixture_case["weights"]]
    total_weight = float(sum(weights))
    normalized_weights = (
        [weight / total_weight for weight in weights]
        if total_weight > 0
        else [1.0 / max(len(weights), 1)] * len(weights)
    )
    cumulative = np.cumsum(np.asarray(normalized_weights, dtype=np.float64))
    if cumulative.size > 0:
        cumulative[-1] = 1.0
    component_index = int(min(np.sum(cumulative < float(mixture_case["componentRoll"])), max(len(weights) - 1, 0)))
    component_mean = mixture_case["means"][component_index]
    component_sigmas = mixture_case["sigmas"][component_index]
    sampled = sample_diagonal(component_mean, component_sigmas, mixture_case["valueRolls"])
    for index, actual_value in enumerate(sampled):
        errors.extend(
            assert_close(
                actual_value,
                float(mixture_case["expectedSample"][index]),
                LOG_DENSITY_ABS_TOL,
                f"fm14 mixture sample[{index}]",
            )
        )
    errors.extend(
        assert_close(
            mixture_log_density(sampled, mixture_case["means"], mixture_case["sigmas"], mixture_case["weights"]),
            float(mixture_case["expectedLogDensity"]),
            LOG_DENSITY_ABS_TOL,
            "fm14 mixture log-density",
        )
    )

    return errors


# ---------------------------------------------------------------------------
# FM-10: conditional filtering
# ---------------------------------------------------------------------------
def verify_conditional_filtering() -> list[str]:
    doc = load_fixture(FIXTURE_DIR / "conditional/filtering.json")
    payload = doc["payload"]
    errors: list[str] = []
    sampler = optuna.samplers.TPESampler(seed=0)

    for case in payload["cases"]:
        required_params = case["requiredParams"]
        search_space = {name: distribution_for_name(name) for name in required_params}
        trials = [
            create_trial(
                state=TrialState.COMPLETE,
                value=0.0,
                params=trial["params"],
                distributions={name: distribution_for_name(name) for name in trial["params"].keys()},
            )
            for trial in case["trials"]
        ]

        internal = sampler._get_internal_repr(trials, search_space)  # pyright: ignore[reportPrivateUsage]
        actual_included = [
            trial["trialNumber"]
            for trial in case["trials"]
            if all(param in trial["params"] for param in required_params)
        ]
        actual_excluded = [
            trial["trialNumber"]
            for trial in case["trials"]
            if trial["trialNumber"] not in actual_included
        ]

        errors.extend(assert_exact(actual_included, case["expectedIncluded"], f"fm10 included {case['id']}"))
        errors.extend(assert_exact(actual_excluded, case["expectedExcluded"], f"fm10 excluded {case['id']}"))

        if search_space:
            for values in internal.values():
                errors.extend(
                    assert_exact(
                        len(values),
                        len(actual_included),
                        f"fm10 internal repr length {case['id']}",
                    )
                )

    return errors


# ---------------------------------------------------------------------------
# FM-11: search-space group decomposition
# ---------------------------------------------------------------------------
def verify_conditional_group_decomposition() -> list[str]:
    doc = load_fixture(FIXTURE_DIR / "conditional/group-decomposition.json")
    payload = doc["payload"]
    group = _SearchSpaceGroup()

    for addition in payload["additions"]:
        group.add_distributions({name: distribution_for_name(name) for name in addition})

    actual_groups = canonical_groups(group.search_spaces)
    return assert_exact(actual_groups, payload["expectedGroups"], "fm11 group decomposition")


# ---------------------------------------------------------------------------
# FM-13: percentile pruner boundaries
# ---------------------------------------------------------------------------
def verify_percentile_pruner() -> list[str]:
    doc = load_fixture(FIXTURE_DIR / "pruning/percentile-pruner.json")
    payload = doc["payload"]
    errors: list[str] = []

    for case in payload["cases"]:
        settings = case["settings"]
        pruner = optuna.pruners.PercentilePruner(
            percentile=settings["percentile"],
            n_startup_trials=settings["startupTrials"],
            n_warmup_steps=settings["warmupSteps"],
            interval_steps=settings["intervalSteps"],
            n_min_trials=settings["nMinTrials"],
        )
        study = optuna.create_study(direction=payload["direction"], pruner=pruner)

        for history_trial in case["history"]:
            if history_trial["state"] != "complete":
                continue

            reports = {
                int(report["step"]): float(report["value"])
                for report in history_trial["reports"]
            }
            completed_trial = create_trial(
                state=TrialState.COMPLETE,
                value=float(history_trial["reports"][-1]["value"]) if history_trial["reports"] else 0.0,
                params={},
                distributions={},
                intermediate_values=reports,
            )
            study.add_trial(completed_trial)

        current_trial = create_trial(
            state=TrialState.RUNNING,
            params={},
            distributions={},
            intermediate_values={int(case["step"]): float(case["currentValue"])},
        )
        actual_should_prune = pruner.prune(study, current_trial)
        errors.extend(
            assert_exact(
                actual_should_prune,
                case["expectedShouldPrune"],
                f"fm13 should-prune {case['id']}",
            )
        )

    return errors


# ---------------------------------------------------------------------------
# FM-6: MOTPE weights
# ---------------------------------------------------------------------------
def verify_motpe_weights() -> list[str]:
    errors: list[str] = []
    fixture_paths = sorted(FIXTURE_DIR.glob("motpe-weights*.json"))

    if not fixture_paths:
        return ["  FAIL motpe-weights: no fixture files found"]

    for fixture_path in fixture_paths:
        doc = load_fixture(fixture_path)
        payload = doc["payload"]
        fixture_name = doc["fixture"]

        directions = payload["directions"]
        loss_points = [to_loss_point(point, directions) for point in payload["points"]]
        loss_reference = to_loss_point(payload["referencePoint"], directions)
        points = np.array(loss_points, dtype=np.float64)
        ref = np.array(loss_reference, dtype=np.float64)

        total_hv = compute_hypervolume(points, ref)

        for index in range(len(points)):
            subset = np.delete(points, index, axis=0)
            hv_without = compute_hypervolume(subset, ref)
            contribution = max(total_hv - hv_without, 0.0)
            errors.extend(
                assert_close(
                    payload["expectedContributions"][index],
                    contribution,
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} contrib[{index}]",
                )
            )

        max_contrib = max(payload["expectedContributions"])
        eps = 1e-12
        for index, contribution in enumerate(payload["expectedContributions"]):
            expected_weight = max(contribution / max(max_contrib, eps), eps)
            errors.extend(
                assert_close(
                    payload["expectedWeights"][index],
                    expected_weight,
                    LOG_DENSITY_ABS_TOL,
                    f"{fixture_name} weight[{index}]",
                )
            )

    return errors


# ---------------------------------------------------------------------------
# FM-5: MOTPE reference point
# ---------------------------------------------------------------------------
def verify_motpe_reference() -> list[str]:
    doc = load_fixture(FIXTURE_DIR / "motpe-reference/reference-point.json")
    payload = doc["payload"]
    errors: list[str] = []

    epsilon = payload["epsilon"]
    for case in payload["cases"]:
        for index, worst in enumerate(case["worstPoint"]):
            reference = max(1.1 * worst, 0.9 * worst)
            expected_reference = epsilon if reference == 0 else reference
            errors.extend(
                assert_close(
                    case["expectedReferencePoint"][index],
                    expected_reference,
                    LOG_DENSITY_ABS_TOL,
                    f"motpe ref[{case['id']}][{index}]",
                )
            )

    return errors


# ---------------------------------------------------------------------------
# FM-3: pruned score ordering
# ---------------------------------------------------------------------------
def verify_pruned_score() -> list[str]:
    doc = load_fixture(FIXTURE_DIR / "pruned-score/pruned-ordering.json")
    payload = doc["payload"]
    errors: list[str] = []

    scored_trials: list[tuple[float, int, int]] = []

    for case in payload["cases"]:
        intermediates = case["intermediateValues"]
        if not intermediates:
            score = float("inf")
            step = -1
        else:
            last = intermediates[-1]
            step = last["step"]
            value = last["value"]
            if isinstance(value, str) and value == "NaN":
                score = float("inf")
            elif isinstance(value, float) and math.isnan(value):
                score = float("inf")
            else:
                score = float(value)

        errors.extend(assert_exact(case["expectedStep"], step, f"pruned-score step {case['id']}"))

        if case["expectedScore"] == "Infinity":
            if not math.isinf(score) or score < 0:
                errors.append(f"  FAIL pruned-score score {case['id']}: expected=Infinity, actual={score}")
        else:
            errors.extend(
                assert_close(score, float(case["expectedScore"]), LOG_DENSITY_ABS_TOL, f"pruned-score score {case['id']}")
            )

        scored_trials.append((score, step, case["trialNumber"]))

    finite_trials = [(score, trial_number) for score, _, trial_number in scored_trials if not math.isinf(score)]
    infinite_trials = [(score, trial_number) for score, _, trial_number in scored_trials if math.isinf(score)]
    expected_order = payload["expectedOrder"]

    if finite_trials and infinite_trials:
        last_finite_position = max(expected_order.index(trial_number) for _, trial_number in finite_trials)
        first_infinite_position = min(expected_order.index(trial_number) for _, trial_number in infinite_trials)
        if last_finite_position >= first_infinite_position:
            errors.append("  FAIL pruned-score order: finite trials should precede infinite trials")

    return errors


# ---------------------------------------------------------------------------
# FM-17: advanced sampler fixture contracts
# ---------------------------------------------------------------------------
def verify_advanced_samplers_contract() -> list[str]:
    errors: list[str] = []
    fixture_specs = [
        ("advanced-samplers.cmaes-parity", "advanced-samplers/cmaes-parity.json"),
        ("advanced-samplers.gpbo-parity", "advanced-samplers/gpbo-parity.json"),
    ]

    manifest = load_fixture(FIXTURE_DIR / "manifest.json")
    entries = {(entry["name"], entry["file"]) for entry in manifest.get("fixtures", [])}
    for name, file in fixture_specs:
        if (name, file) not in entries:
            errors.append(f"  FAIL advanced-samplers manifest: missing ({name}, {file})")

    for fixture_name, relative_path in fixture_specs:
        fixture_path = FIXTURE_DIR / relative_path
        doc = load_fixture(fixture_path)
        payload = doc["payload"]
        context = payload["context"]
        space = payload["space"]
        expected = payload["expected"]

        errors.extend(assert_exact(doc["fixture"], fixture_name, f"advanced-samplers fixture tag {fixture_name}"))

        lows = {
            "x": space["x"]["low"],
            "y": space["y"]["low"],
        }
        highs = {
            "x": space["x"]["high"],
            "y": space["y"]["high"],
        }

        for axis in ("x", "y"):
            errors.extend(_assert_finite(lows[axis], f"{fixture_name} space.{axis}.low"))
            errors.extend(_assert_finite(highs[axis], f"{fixture_name} space.{axis}.high"))
            if _is_finite_number(lows[axis]) and _is_finite_number(highs[axis]):
                if float(lows[axis]) >= float(highs[axis]):
                    errors.append(
                        f"  FAIL {fixture_name} space.{axis}: low must be < high, got {lows[axis]} >= {highs[axis]}"
                    )

            errors.extend(
                _assert_within_bounds(
                    expected[axis],
                    lows[axis],
                    highs[axis],
                    f"{fixture_name} expected.{axis}",
                )
            )

        completed = context["completed"]
        next_trial_number = context["nextTrialNumber"]
        if len(completed) <= 0:
            errors.append(f"  FAIL {fixture_name} context.completed: expected non-empty trial history")

        trial_numbers = [entry["trialNumber"] for entry in completed]
        for index, trial_number in enumerate(trial_numbers):
            errors.extend(_assert_finite(trial_number, f"{fixture_name} completed[{index}].trialNumber"))

        if trial_numbers:
            max_trial = max(int(trial_number) for trial_number in trial_numbers)
            errors.extend(
                assert_exact(
                    int(next_trial_number),
                    max_trial + 1,
                    f"{fixture_name} nextTrialNumber sequencing",
                )
            )

        for index, entry in enumerate(completed):
            config = entry["config"]
            errors.extend(_assert_finite(entry["value"], f"{fixture_name} completed[{index}].value"))
            for axis in ("x", "y"):
                errors.extend(
                    _assert_within_bounds(
                        config[axis],
                        lows[axis],
                        highs[axis],
                        f"{fixture_name} completed[{index}].config.{axis}",
                    )
                )

    return errors


VERIFIERS: dict[str, Any] = {
    "FM-1 gamma": verify_gamma,
    "FM-2 split-trials": verify_split_trials,
    "FM-16 constrained-tpe": verify_constrained_tpe,
    "FM-4 motpe-split": verify_motpe_split,
    "FM-10 conditional-filtering": verify_conditional_filtering,
    "FM-11 group-decomposition": verify_conditional_group_decomposition,
    "FM-13 percentile-pruner": verify_percentile_pruner,
    "FM-7 categorical-parzen": verify_categorical_parzen,
    "FM-8 continuous-kde": verify_continuous_kde,
    "FM-15 noise-bandwidth": verify_noise_bandwidth,
    "M4 truncated-normal": verify_truncated_normal,
    "FM-9 ei": verify_ei,
    "FM-9 mixed-space": verify_mixed_space_joint_trace,
    "FM-14 multivariate-gaussian": verify_multivariate_gaussian,
    "FM-6 motpe-weights": verify_motpe_weights,
    "FM-5 motpe-reference": verify_motpe_reference,
    "FM-3 pruned-score": verify_pruned_score,
    "FM-17 advanced-samplers-contract": verify_advanced_samplers_contract,
}


def main() -> None:
    total_errors: list[str] = []
    passed = 0
    failed = 0

    print(f"Verifying fixtures in {FIXTURE_DIR.resolve()}")
    print(f"Optuna version: {optuna.__version__}")
    print()

    for name, verifier in VERIFIERS.items():
        try:
            errors = verifier()
        except FileNotFoundError as error:
            errors = [f"  SKIP: {error}"]
        except Exception as error:  # pragma: no cover - defensive script boundary
            errors = [f"  ERROR: {type(error).__name__}: {error}"]

        if errors:
            print(f"✗ {name}")
            for error in errors:
                print(error)
            total_errors.extend(errors)
            failed += 1
        else:
            print(f"✓ {name}")
            passed += 1

    print()
    print(f"Results: {passed} passed, {failed} failed")

    if total_errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
