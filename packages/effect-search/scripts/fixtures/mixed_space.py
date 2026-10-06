"""Actual Optuna joint mixed-space sampling, densities and acquisition selection."""

import numpy as np
import optuna
from optuna.distributions import CategoricalDistribution, FloatDistribution, IntDistribution
from optuna.samplers._tpe.parzen_estimator import _ParzenEstimator, _ParzenEstimatorParameters
from optuna.samplers._tpe.sampler import default_weights

from ._common import metadata, RecordingRandomState

CHOICES = ["adam", "sgd", "adamw"]
SPACE = {"optimizer": CategoricalDistribution(CHOICES), "lr": FloatDistribution(.0005, .2, log=True),
         "depth": IntDistribution(1, 8)}
SCENARIOS = [
    ("joint-trace", 41,
     [("adam", .009, 5, .11), ("adam", .014, 4, .16), ("adamw", .018, 5, .18),
      ("adam", .022, 6, .19), ("adamw", .012, 5, .17), ("adam", .03, 4, .21)],
     [("sgd", .08, 2, .72), ("sgd", .12, 3, .83), ("sgd", .16, 1, .91),
      ("adamw", .14, 2, .68), ("adam", .11, 7, .62), ("sgd", .2, 8, 1.05),
      ("adamw", .09, 3, .58), ("adam", .07, 2, .51), ("sgd", .05, 6, .57),
      ("adamw", .13, 7, .74), ("adam", .19, 8, .95), ("sgd", .09, 4, .64)]),
    ("joint-trace.recency-shift", 73,
     [("adam", .002, 3, .08), ("adamw", .006, 4, .1), ("sgd", .01, 2, .11),
      ("adam", .015, 5, .12), ("adamw", .025, 6, .13), ("adam", .04, 4, .14), ("sgd", .03, 3, .15)],
     [("sgd", .12, 8, .9), ("adamw", .18, 7, 1.), ("sgd", .16, 6, .95),
      ("adam", .09, 8, .88), ("adamw", .14, 7, .92), ("sgd", .2, 5, 1.1),
      ("adam", .11, 6, .85), ("adamw", .13, 8, .97), ("sgd", .08, 5, .8),
      ("adam", .07, 7, .82), ("adamw", .1, 6, .86), ("sgd", .15, 4, .89)]),
]


def generate(generated_at):
    documents = []
    for suffix, seed, below_rows, above_rows in SCENARIOS:
        params = _ParzenEstimatorParameters(1., True, False, default_weights, False, {})
        observations = [{"optimizer": np.asarray([CHOICES.index(row[0]) for row in rows], dtype=float),
                         "lr": np.asarray([row[1] for row in rows]), "depth": np.asarray([row[2] for row in rows], dtype=float)}
                        for rows in (below_rows, above_rows)]
        below, above = [_ParzenEstimator(obs, SPACE, params) for obs in observations]
        rng = RecordingRandomState(seed)
        samples = below.sample(rng, 8)
        sampler = optuna.samplers.TPESampler(seed=seed)
        scores = sampler._compute_acquisition_func(samples, below, above)
        selected = sampler._compare(samples, scores)

        def config(sample):
            return {"optimizer": CHOICES[int(sample["optimizer"])], "lr": float(sample["lr"]), "depth": int(sample["depth"])}

        configs = [config({name: values[index] for name, values in samples.items()}) for index in range(8)]
        dimensions = []
        for name, kind, values in [("optimizer", "categorical", rng.categorical_rolls),
                                  ("lr", "float", rng.value_rolls[:8]), ("depth", "int", rng.value_rolls[8:])]:
            marginal_below, marginal_above = [_ParzenEstimator({name: obs[name]}, {name: SPACE[name]}, params) for obs in observations]
            probes = {name: samples[name]}
            log_l, log_g = marginal_below.log_pdf(probes), marginal_above.log_pdf(probes)
            dimensions.append({"name": name, "kind": kind,
                               "candidateRolls": list(zip(rng.component_rolls, values, strict=True)),
                               "candidates": [candidate[name] for candidate in configs],
                               "logL": log_l.tolist(), "logG": log_g.tolist(),
                               "scores": sampler._compute_acquisition_func(probes, marginal_below, marginal_above).tolist()})
        rows = [{"trialNumber": index, "config": {"optimizer": row[0], "lr": row[1], "depth": row[2]}, "value": row[3]}
                for index, row in enumerate(below_rows + above_rows, 1)]
        documents.append({"fixture": f"mixed-space.{suffix}", "file": f"mixed-space/{suffix.replace('.', '-')}.json",
                          "metadata": metadata(generated_at), "payload": {
                              "space": {"optimizer": {"type": "categorical", "choices": CHOICES},
                                        "lr": {"type": "float", "low": .0005, "high": .2, "scale": "log"},
                                        "depth": {"type": "int", "low": 1, "high": 8, "step": 1}},
                              "sampler": {"seed": seed, "nStartupTrials": 0, "nEiCandidates": 8, "nextTrialNumber": len(rows) + 1},
                              "split": {"below": rows[:len(below_rows)], "above": rows[len(below_rows):]},
                              "dimensions": dimensions, "expected": {
                                  "candidateConfigs": configs, "jointScores": scores.tolist(),
                                  "expectedBestIndex": configs.index(config(selected)), "expectedSuggestion": config(selected),
                              },
                          }})
    return documents
