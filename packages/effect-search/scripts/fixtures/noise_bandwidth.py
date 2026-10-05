"""Optuna base bandwidths on clustered and scattered observations.

Theoria's noise adjustment is not an Optuna policy and is not reference evidence.
"""

import numpy as np
from optuna.distributions import FloatDistribution
from optuna.samplers._tpe.parzen_estimator import _ParzenEstimator, _ParzenEstimatorParameters
from optuna.samplers._tpe.sampler import default_weights

from ._common import metadata


def generate(generated_at):
    cases = []
    for name, observations, low, high in [
        ("low-noise-smooth", [.12, .14, .15, .16, .18, .19], 0., 1.),
        ("high-noise-zigzag", [.03, .94, .11, .88, .22, .79], 0., 1.),
        ("cross-zero-range", [-1.8, -.4, 1.2, -1.1, .6, 1.7], -2., 2.),
    ]:
        estimator = _ParzenEstimator(
            {"x": np.asarray(observations)}, {"x": FloatDistribution(low, high)},
            _ParzenEstimatorParameters(1., True, False, default_weights, False, {}),
        )
        cases.append({"id": name, "observations": observations, "low": low, "high": high,
                      "expected": {"baseSigmas": estimator._mixture_distribution.distributions[0].sigma.tolist()}})
    return [{"fixture": "noise-bandwidth.parity", "file": "noise-bandwidth/parity.json",
             "metadata": metadata(generated_at), "payload": {"cases": cases}}]
