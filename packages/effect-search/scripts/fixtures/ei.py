"""FM-9: acquisition scoring (EI) fixture generation from Optuna internals."""

from __future__ import annotations

from typing import Any

import numpy as np
from optuna.distributions import CategoricalDistribution, FloatDistribution
from optuna.samplers._tpe.parzen_estimator import _ParzenEstimator, _ParzenEstimatorParameters
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


def _score_trace(
    samples: dict[str, np.ndarray],
    labels: list[str],
    mpe_below: _ParzenEstimator,
    mpe_above: _ParzenEstimator,
) -> dict[str, Any]:
    log_likelihood_below = mpe_below.log_pdf(samples)
    log_likelihood_above = mpe_above.log_pdf(samples)
    score_vector = log_likelihood_below - log_likelihood_above

    return {
        "scoreTrace": [
            {
                "candidate": labels[index],
                "logL": float(log_likelihood_below[index]),
                "logG": float(log_likelihood_above[index]),
                "expected": float(score_vector[index]),
            }
            for index in range(len(labels))
        ],
        "scoreVector": score_vector.astype(np.float64).tolist(),
        "expectedBestIndex": int(np.argmax(score_vector)),
    }


def _build_univariate_fixture(generated_at: str) -> dict[str, Any]:
    param_name = "x"
    search_space = {param_name: FloatDistribution(low=0.0, high=1.0)}
    below = _ParzenEstimator(
        {param_name: np.asarray([0.1, 0.15, 0.2, 0.24], dtype=np.float64)},
        search_space,
        _parameters(),
    )
    above = _ParzenEstimator(
        {param_name: np.asarray([0.55, 0.63, 0.74, 0.86], dtype=np.float64)},
        search_space,
        _parameters(),
    )
    probes = np.asarray([0.05, 0.2, 0.4, 0.7, 0.9], dtype=np.float64)
    labels = [f"x={value:.3f}" for value in probes.tolist()]

    return {
        "fixture": "ei.basic",
        "file": "ei/basic.json",
        "metadata": metadata(generated_at),
        "payload": _score_trace({param_name: probes}, labels, below, above),
    }


def _build_mixed_fixture(generated_at: str) -> dict[str, Any]:
    optimizer_name = "optimizer"
    learning_rate_name = "lr"
    search_space = {
        optimizer_name: CategoricalDistribution(["adam", "sgd", "adamw"]),
        learning_rate_name: FloatDistribution(low=0.0005, high=0.2, log=True),
    }
    below = _ParzenEstimator(
        {
            optimizer_name: np.asarray([0, 0, 2, 0, 2], dtype=np.float64),
            learning_rate_name: np.asarray([0.006, 0.012, 0.025, 0.008, 0.018], dtype=np.float64),
        },
        search_space,
        _parameters(),
    )
    above = _ParzenEstimator(
        {
            optimizer_name: np.asarray([1, 1, 2, 1, 0], dtype=np.float64),
            learning_rate_name: np.asarray([0.08, 0.12, 0.15, 0.09, 0.11], dtype=np.float64),
        },
        search_space,
        _parameters(),
    )
    optimizer_samples = np.asarray([0, 1, 2, 0, 2], dtype=np.float64)
    learning_rate_samples = np.asarray([0.01, 0.1, 0.03, 0.005, 0.14], dtype=np.float64)
    optimizer_labels = ["adam", "sgd", "adamw"]
    labels = [
        f"{optimizer_labels[int(optimizer_samples[index])]}@{learning_rate_samples[index]:.3f}"
        for index in range(len(optimizer_samples))
    ]

    return {
        "fixture": "ei.mixed-trace",
        "file": "ei/mixed-trace.json",
        "metadata": metadata(generated_at),
        "payload": _score_trace(
            {
                optimizer_name: optimizer_samples,
                learning_rate_name: learning_rate_samples,
            },
            labels,
            below,
            above,
        ),
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        _build_univariate_fixture(generated_at),
        _build_mixed_fixture(generated_at),
    ]
