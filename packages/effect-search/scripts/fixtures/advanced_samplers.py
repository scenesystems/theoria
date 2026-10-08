"""Advanced sampler fixture family for CMA-ES and GP-BO deterministic parity."""

from __future__ import annotations

from typing import Any

import optuna
import torch
from optuna.distributions import FloatDistribution

from ._common import metadata


def _context() -> dict[str, Any]:
    return {
        "nextTrialNumber": 4,
        "completed": [
            {
                "trialNumber": 0,
                "config": {"x": -1.2, "y": 0.5},
                "value": 3.2,
            },
            {
                "trialNumber": 1,
                "config": {"x": 0.8, "y": -0.1},
                "value": 1.1,
            },
            {
                "trialNumber": 2,
                "config": {"x": 1.0, "y": -0.2},
                "value": 0.9,
            },
            {
                "trialNumber": 3,
                "config": {"x": 2.0, "y": 1.2},
                "value": 4.7,
            },
        ],
    }


def _space() -> dict[str, Any]:
    return {
        "x": {"low": -3.0, "high": 3.0},
        "y": {"low": -2.0, "high": 2.0},
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    torch.set_num_threads(1)
    documents = [
        {
            "fixture": "advanced-samplers.cmaes-parity",
            "file": "advanced-samplers/cmaes-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "space": _space(),
                "context": _context(),
                "sampler": {
                    "seed": 23,
                    "sigma": 0.55,
                    "populationSize": 8,
                },
            },
        },
        {
            "fixture": "advanced-samplers.gpbo-parity",
            "file": "advanced-samplers/gpbo-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "space": _space(),
                "context": _context(),
                "sampler": {
                    "seed": 23,
                    "nStartupTrials": 2,
                },
            },
        },
    ]
    for document, sampler in zip(documents, [
        optuna.samplers.CmaEsSampler(seed=23, sigma0=.55, popsize=8),
        optuna.samplers.GPSampler(seed=23, n_startup_trials=2),
    ], strict=True):
        payload = document["payload"]
        distributions = {name: FloatDistribution(**bounds) for name, bounds in payload["space"].items()}
        study = optuna.create_study(sampler=sampler, direction="minimize")
        for row in payload["context"]["completed"]:
            study.add_trial(optuna.trial.create_trial(value=row["value"], params=row["config"], distributions=distributions))
        payload["expected"] = study.ask(distributions).params
    return documents
