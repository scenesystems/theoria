"""Numeric TPE replays: stepped-float grid-cell density and default independent mixed sampling."""

from __future__ import annotations

import contextlib
from typing import Any

import numpy as np
import optuna
from optuna.distributions import FloatDistribution
from optuna.samplers._tpe import sampler as tpe
from optuna.trial import create_trial

from ._common import metadata

# A positive acquisition gap at or under this bound is a near tie whose winner may depend on libm
# last bits; replay assertions stop before such a trial. Exact zero gaps are first-index argmax ties.
NEAR_TIE = 1e-9


@contextlib.contextmanager
def _observed_acquisitions():
    """Observe TPESampler._compare inputs without changing its selection."""
    original = tpe.TPESampler.__dict__["_compare"]
    observed = []

    def compare(cls, samples, acquisition):
        observed.append(({name: np.asarray(values).copy() for name, values in samples.items()},
                         np.asarray(acquisition).copy()))
        return original.__func__(cls, samples, acquisition)

    tpe.TPESampler._compare = classmethod(compare)
    try:
        yield observed
    finally:
        tpe.TPESampler._compare = original


def _selection_gap(samples, acquisition) -> float | None:
    """Winner margin over the best differing candidate; None when every candidate is the winner."""
    best = int(np.argmax(acquisition))
    winner = tuple(values[best] for values in samples.values())
    others = [acquisition[index] for index in range(acquisition.size)
              if tuple(values[index] for values in samples.values()) != winner]
    return round(float(acquisition[best] - max(others)), 12) if others else None


STEPPED_BELOW = [(0.25, 0.0), (0.5, 0.01)]
STEPPED_ABOVE_X = [0.0, 0.75, 1.0, 1.0, 0.75, 0.0, 0.5, 0.25, 0.0, 1.0, 0.75, 0.25, 1.0, 0.0, 0.5, 0.75, 1.0, 0.25]


def _stepped_float(generated_at: str) -> dict[str, Any]:
    distribution = FloatDistribution(0.0, 1.0, step=0.25)
    history = STEPPED_BELOW + [(x, 1.0 + index / 10) for index, x in enumerate(STEPPED_ABOVE_X)]
    runs = []
    for n_ei_candidates in (24, 3):
        rows = []
        for seed in range(60):
            sampler = tpe.TPESampler(seed=seed, n_startup_trials=10, n_ei_candidates=n_ei_candidates)
            study = optuna.create_study(sampler=sampler)
            for x, value in history:
                study.add_trial(create_trial(params={"x": x}, distributions={"x": distribution}, value=value))
            with _observed_acquisitions() as observed:
                trial = study.ask()
                selected = trial.suggest_float("x", 0.0, 1.0, step=0.25)
            (samples, acquisition), = observed
            rows.append({"seed": seed, "selected": selected,
                         "gap": _selection_gap(samples, acquisition)})
        runs.append({"nEiCandidates": n_ei_candidates, "expected": rows})
    return {
        "fixture": "tpe-numeric.stepped-float",
        "file": "tpe-numeric/stepped-float.json",
        "metadata": metadata(generated_at),
        "payload": {
            "space": {"low": 0.0, "high": 1.0, "step": 0.25},
            "sampler": {"nStartupTrials": 10, "multivariate": False},
            "history": [{"trialNumber": number, "x": x, "value": value} for number, (x, value) in enumerate(history)],
            "nearTie": NEAR_TIE,
            "runs": runs,
        },
    }


def _objective_float_int(trial):
    x = trial.suggest_float("x", 0.0, 1.0)
    y = trial.suggest_int("y", 1, 8)
    return (x - 0.3) * (x - 0.3) + (y - 5) * (y - 5) / 10


CATEGORY_COST = {"a": 0.3, "b": 0.0, "c": 0.6}


def _objective_step_log_categorical(trial):
    x = trial.suggest_float("x", 0.0, 1.0, step=0.1)
    y = trial.suggest_float("y", 0.001, 1.0, log=True)
    z = trial.suggest_categorical("z", ["a", "b", "c"])
    return (x - 0.6) * (x - 0.6) + (y - 0.05) * (y - 0.05) * 10 + CATEGORY_COST[z]


MIXED_CASES = [
    ("float-int", _objective_float_int, (0, 1, 2)),
    ("step-log-categorical", _objective_step_log_categorical, (0, 1)),
]


def _mixed_default(generated_at: str) -> dict[str, Any]:
    trials_per_run, startup = 16, 4
    runs = []
    for space, objective, seeds in MIXED_CASES:
        for seed in seeds:
            sampler = tpe.TPESampler(seed=seed, n_startup_trials=startup, n_ei_candidates=24)
            study = optuna.create_study(sampler=sampler)
            gaps = []
            with _observed_acquisitions() as observed:
                for _ in range(trials_per_run):
                    before = len(observed)
                    study.optimize(objective, n_trials=1)
                    gaps.append([_selection_gap(*entry) for entry in observed[before:]])
            near = [number for number, trial_gaps in enumerate(gaps) if any(gap is not None and 0 < gap <= NEAR_TIE for gap in trial_gaps)]
            runs.append({
                "space": space, "seed": seed,
                "trace": [{"number": trial.number, "params": trial.params, "value": trial.value}
                          for trial in study.trials],
                "gaps": gaps,
                "strictThroughTrial": (near[0] if near else trials_per_run) - 1,
            })
    return {
        "fixture": "tpe-numeric.mixed-default",
        "file": "tpe-numeric/mixed-default.json",
        "metadata": metadata(generated_at),
        "payload": {
            "sampler": {"nStartupTrials": startup, "nEiCandidates": 24,
                        "multivariate": tpe.TPESampler()._multivariate},
            "categoryCost": CATEGORY_COST,
            "nearTie": NEAR_TIE,
            "runs": runs,
        },
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [_stepped_float(generated_at), _mixed_default(generated_at)]
