"""Optuna feasibility split and Parzen kernels on constraint observations.

No claim that Theoria's density-ratio product is an Optuna policy.
"""

import numpy as np
import optuna
from optuna.distributions import FloatDistribution
from optuna.samplers._tpe.parzen_estimator import _ParzenEstimator, _ParzenEstimatorParameters
from optuna.samplers._tpe.sampler import _split_trials, default_gamma, default_weights
from optuna.trial import create_trial

from ._common import metadata


def generate(generated_at):
    density_cases = []
    for name, observations, probes, bounds in [
        ("single-constraint", [[-.6], [-.1], [.05], [.35], [1.2]], [[-.25], [.1], [.8]], [(-1.6, 2.2)]),
        ("two-constraints", [[-.5, -.2], [-.2, .4], [.2, .1], [.8, 1.1], [1.3, .6]],
         [[-.3, -.1], [.1, .2], [.9, .9]], [(-1.5, 2.3), (-1.2, 2.1)]),
    ]:
        densities = []
        for index, (low, high) in enumerate(bounds):
            values = np.asarray(observations)[:, index]
            samples = {"x": np.asarray(probes)[:, index]}
            logs = {}
            for label, subset in [("feasible", values[values <= 0]), ("infeasible", values[values > 0])]:
                estimator = _ParzenEstimator(
                    {"x": subset}, {"x": FloatDistribution(low, high)},
                    _ParzenEstimatorParameters(1., True, False, default_weights, False, {}),
                )
                logs[label] = estimator.log_pdf(samples).tolist()
            densities.append(logs)
        density_cases.append({"id": name, "observations": observations, "probes": probes,
                              "bounds": [{"low": low, "high": high} for low, high in bounds],
                              "expectedLogDensities": densities})
    rows = [
        {"trialNumber": 0, "value": .2, "constraints": [-.4]},
        {"trialNumber": 1, "value": .1, "constraints": [.15]},
        {"trialNumber": 2, "value": .3, "constraints": [-.2]},
        {"trialNumber": 3, "value": .05, "constraints": [.7]},
    ]
    study = optuna.create_study(direction="minimize")
    for row in rows:
        study.add_trial(create_trial(value=row["value"], system_attrs={"constraints": row["constraints"]}))
    n_below = default_gamma(len(rows))
    below, above = _split_trials(study, study.trials, n_below, constraints_enabled=True)
    return [{"fixture": "constrained-tpe.parity", "file": "constrained-tpe/parity.json",
             "metadata": metadata(generated_at), "payload": {
                 "densityCases": density_cases, "splitCase": {
                     "direction": "minimize", "nBelow": n_below, "trials": rows,
                     "expectedBelow": [trial.number for trial in below],
                     "expectedAbove": [trial.number for trial in above],
                 },
             }}]
