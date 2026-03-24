"""FM-16: constrained TPE density-ratio and split parity fixtures."""

from __future__ import annotations

from typing import Any

import numpy as np
import optuna
from optuna.distributions import FloatDistribution
from optuna.samplers._tpe.parzen_estimator import _ParzenEstimator, _ParzenEstimatorParameters
from optuna.samplers._tpe.sampler import _split_trials, default_gamma, default_weights
from optuna.trial import TrialState, create_trial

from ._common import metadata

RATIO_EPSILON = 1e-12
RATIO_MAX = 1.0 / RATIO_EPSILON
BOUNDS_PADDING_RATIO = 0.05


def _parzen_parameters() -> _ParzenEstimatorParameters:
    return _ParzenEstimatorParameters(
        True,
        1.0,
        True,
        False,
        default_weights,
        False,
        {},
    )


def _finite_or_infinity(value: float) -> float:
    return float(value) if np.isfinite(value) else float("inf")


def _constraint_value_at(values: list[float], index: int) -> float:
    if index < len(values):
        return _finite_or_infinity(float(values[index]))

    return float("inf")


def _dimension_count(observations: list[list[float]]) -> int:
    return max((len(observation) for observation in observations), default=0)


def _values_for_dimension(observations: list[list[float]], index: int) -> list[float]:
    return [_constraint_value_at(observation, index) for observation in observations]


def _bounds(values: list[float]) -> tuple[float, float]:
    finite_values = [value for value in values if np.isfinite(value)]
    if not finite_values:
        return -1.0, 1.0

    minimum = min(finite_values)
    maximum = max(finite_values)
    span = maximum - minimum
    padding = 1.0 if span <= 0 else max(1.0, span * BOUNDS_PADDING_RATIO)
    return minimum - padding, maximum + padding


def _log_density(values: list[float], probe: float, low: float, high: float) -> float:
    estimator = _ParzenEstimator(
        {"x": np.asarray(values, dtype=np.float64)},
        {"x": FloatDistribution(low=low, high=high)},
        _parzen_parameters(),
    )
    return float(estimator.log_pdf({"x": np.asarray([probe], dtype=np.float64)})[0])


def _stabilize_ratio(value: float) -> float:
    if np.isfinite(value):
        return float(min(max(value, RATIO_EPSILON), RATIO_MAX))

    return RATIO_MAX if value > 0 else RATIO_EPSILON


def _is_feasible(value: float) -> bool:
    return _finite_or_infinity(value) <= 0


def _gamma(values: list[float]) -> float:
    if not values:
        return 0.5

    feasible_count = sum(1 for value in values if _is_feasible(value))
    ratio = feasible_count / len(values)
    return float(min(max(ratio, RATIO_EPSILON), 1.0 - RATIO_EPSILON))


def _constraint_ratio(values: list[float], probe: float) -> float:
    feasible = [value for value in values if _is_feasible(value)]
    infeasible = [value for value in values if not _is_feasible(value)]

    if not feasible or not infeasible:
        return 1.0

    low, high = _bounds(values)
    log_l = _log_density(feasible, probe, low, high)
    log_g = _log_density(infeasible, probe, low, high)
    ratio = _stabilize_ratio(float(np.exp(log_l - log_g)))
    gamma = _gamma(values)
    denominator = gamma * ratio + (1.0 - gamma)

    if np.isfinite(denominator) and denominator > 0:
        return _stabilize_ratio(ratio / denominator)

    return RATIO_EPSILON


def _ratio_product(observations: list[list[float]], probe: list[float]) -> float:
    dimension_count = _dimension_count(observations)
    ratios = [
        _constraint_ratio(_values_for_dimension(observations, index), _constraint_value_at(probe, index))
        for index in range(dimension_count)
    ]
    return float(np.exp(sum(np.log(ratio) for ratio in ratios)))


def _descending_order(values: list[float]) -> list[int]:
    return [entry[0] for entry in sorted(enumerate(values), key=lambda entry: (-entry[1], entry[0]))]


def _density_case(
    case_id: str,
    observations: list[list[float]],
    probes: list[list[float]],
) -> dict[str, Any]:
    expected_ratio_products = [_ratio_product(observations, probe) for probe in probes]
    expected_order = _descending_order(expected_ratio_products)

    return {
        "id": case_id,
        "observations": observations,
        "probes": probes,
        "expectedRatioProducts": expected_ratio_products,
        "expectedOrder": expected_order,
    }


def _split_expectations(
    direction: str,
    n_below: int,
    trials_payload: list[dict[str, Any]],
) -> tuple[list[int], list[int]]:
    study = optuna.create_study(direction=direction)
    trials = []

    for trial_payload in trials_payload:
        trial = create_trial(
            state=TrialState.COMPLETE,
            value=float(trial_payload["value"]),
            params={},
            distributions={},
            system_attrs={"constraints": trial_payload["constraints"]},
        )
        trial._number = int(trial_payload["trialNumber"])
        trials.append(trial)

    below, above = _split_trials(study, trials, n_below, constraints_enabled=True)
    return [trial.number for trial in below], [trial.number for trial in above]


def generate(generated_at: str) -> list[dict[str, Any]]:
    density_cases = [
        _density_case(
            "single-constraint",
            observations=[[-0.6], [-0.1], [0.05], [0.35], [1.2]],
            probes=[[-0.25], [0.1], [0.8]],
        ),
        _density_case(
            "two-constraints",
            observations=[[-0.5, -0.2], [-0.2, 0.4], [0.2, 0.1], [0.8, 1.1], [1.3, 0.6]],
            probes=[[-0.3, -0.1], [0.1, 0.2], [0.9, 0.9]],
        ),
    ]

    split_trials = [
        {"trialNumber": 0, "value": 0.2, "constraints": [-0.4]},
        {"trialNumber": 1, "value": 0.1, "constraints": [0.15]},
        {"trialNumber": 2, "value": 0.3, "constraints": [-0.2]},
        {"trialNumber": 3, "value": 0.05, "constraints": [0.7]},
    ]
    n_below = int(default_gamma(len(split_trials)))
    expected_below, expected_above = _split_expectations("minimize", n_below, split_trials)

    return [
        {
            "fixture": "constrained-tpe.parity",
            "file": "constrained-tpe/parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "densityCases": density_cases,
                "splitCase": {
                    "direction": "minimize",
                    "nBelow": n_below,
                    "trials": split_trials,
                    "expectedBelow": expected_below,
                    "expectedAbove": expected_above,
                },
            },
        }
    ]
