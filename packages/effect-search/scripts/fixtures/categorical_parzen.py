"""FM-7: categorical Parzen density fixture generation from Optuna internals."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import numpy as np
from optuna.distributions import CategoricalDistribution
from optuna.samplers._tpe.parzen_estimator import _ParzenEstimator, _ParzenEstimatorParameters
from optuna.samplers._tpe.probability_distributions import _BatchedCategoricalDistributions
from optuna.samplers._tpe.sampler import default_weights

from ._common import metadata

Choice = str | int | float | bool | None
DistanceFunction = Callable[[Choice, Choice], float]


def _parameters(
    distance_functions: dict[str, DistanceFunction] | None = None,
) -> _ParzenEstimatorParameters:
    return _ParzenEstimatorParameters(
        True,
        1.0,
        True,
        False,
        default_weights,
        False,
        distance_functions or {},
    )


def _observation_indices(choices: list[Choice], observations: list[Choice]) -> np.ndarray:
    return np.asarray([choices.index(observation) for observation in observations], dtype=np.float64)


def _absolute_distance(left: Choice, right: Choice) -> float:
    return abs(float(left) - float(right))


def _build_estimator(
    choices: list[Choice],
    observations: list[Choice],
    *,
    distance_metric: str | None,
) -> _ParzenEstimator:
    param_name = "choice"
    search_space = {param_name: CategoricalDistribution(choices)}
    observations_dict = {param_name: _observation_indices(choices, observations)}

    if distance_metric == "absolute":
        return _ParzenEstimator(
            observations_dict,
            search_space,
            _parameters({param_name: _absolute_distance}),
        )

    return _ParzenEstimator(observations_dict, search_space, _parameters())


def _pick_candidates(
    choices: list[Choice], probabilities: np.ndarray, rolls: list[float]
) -> list[Choice]:
    cumulative = np.cumsum(probabilities)
    if cumulative.size > 0:
        cumulative[-1] = 1.0

    picked_indices = [
        int(min(np.sum(cumulative < roll), len(choices) - 1))
        for roll in rolls
    ]
    return [choices[index] for index in picked_indices]


def _fixture_from_case(generated_at: str, case: dict[str, Any]) -> dict[str, Any]:
    choices = case["choices"]
    observations = case["observations"]
    candidate_rolls = case["candidateRolls"]
    distance_metric = case.get("distanceMetric")
    estimator = _build_estimator(choices, observations, distance_metric=distance_metric)
    mixture = estimator._mixture_distribution
    distribution = mixture.distributions[0]

    if not isinstance(distribution, _BatchedCategoricalDistributions):
        raise TypeError("expected categorical batched distribution")

    kernel_weights = mixture.weights.astype(np.float64)
    kernels = distribution.weights.astype(np.float64)
    probabilities = np.sum(kernel_weights[:, np.newaxis] * kernels, axis=0)

    payload: dict[str, Any] = {
        "choices": choices,
        "observations": observations,
        "expected": {
            "kernelWeights": kernel_weights.tolist(),
            "probabilities": probabilities.tolist(),
            "kernels": kernels.tolist(),
            "candidateRolls": candidate_rolls,
            "expectedCandidates": _pick_candidates(choices, probabilities, candidate_rolls),
        },
    }

    if distance_metric is not None:
        payload["distanceMetric"] = distance_metric

    return {
        "fixture": case["fixture"],
        "file": case["file"],
        "metadata": metadata(generated_at),
        "payload": payload,
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        _fixture_from_case(
            generated_at,
            {
                "fixture": "categorical-parzen.basic",
                "file": "categorical-parzen/basic.json",
                "choices": ["adam", "sgd", "adamw"],
                "observations": ["adam", "adam", "sgd", "adamw", "adam"],
                "candidateRolls": [0.01, 0.2, 0.5, 0.8, 0.99],
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "categorical-parzen.distance",
                "file": "categorical-parzen/distance.json",
                "choices": [0, 1, 3, 10],
                "observations": [0, 0, 3, 10, 10, 3],
                "distanceMetric": "absolute",
                "candidateRolls": [0.05, 0.25, 0.45, 0.65, 0.85],
            },
        ),
        _fixture_from_case(
            generated_at,
            {
                "fixture": "categorical-parzen.recency-ramp",
                "file": "categorical-parzen/recency-ramp.json",
                "choices": ["adam", "sgd", "adamw"],
                "observations": [
                    "adam",
                    "sgd",
                    "adamw",
                    "adam",
                    "sgd",
                    "adamw",
                    "adam",
                    "sgd",
                    "adamw",
                    "adam",
                    "sgd",
                    "adamw",
                    "adam",
                    "sgd",
                    "adamw",
                    "adam",
                    "sgd",
                    "adamw",
                    "adam",
                    "sgd",
                    "adamw",
                    "adam",
                    "sgd",
                    "adamw",
                    "adam",
                    "sgd",
                    "adamw",
                    "adam",
                    "sgd",
                    "adamw",
                    "adam",
                    "adam",
                ],
                "candidateRolls": [0.02, 0.18, 0.33, 0.5, 0.72, 0.91],
            },
        ),
    ]
