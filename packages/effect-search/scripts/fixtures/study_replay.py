"""Seeded categorical studies executed by Optuna's TPESampler."""

import optuna

from ._common import metadata


def run_study(settings, *, multi=False):
    study = optuna.create_study(
        directions=["minimize", "minimize"] if multi else ["minimize"],
        sampler=optuna.samplers.TPESampler(
            seed=settings["seed"], n_startup_trials=settings["nStartupTrials"],
            n_ei_candidates=settings["nEiCandidates"],
        ),
    )

    def objective(trial):
        instruction = trial.suggest_categorical("instruction", ["baseline", "rewrite", "counterexample", "socratic"])
        demos = trial.suggest_categorical("demos", ["none", "few", "curated"])
        scoring = trial.suggest_categorical("scoring", ["strict", "balanced", "recall"])
        if multi:
            latency = ({"baseline": .3, "rewrite": .9, "counterexample": 1.5, "socratic": 2.1}[instruction]
                       + {"none": .1, "few": .6, "curated": 1.3}[demos]
                       + {"recall": .2, "balanced": .5, "strict": 1.1}[scoring])
            loss = ({"baseline": 2, "rewrite": 1.2, "counterexample": .8, "socratic": .5}[instruction]
                    + {"none": 1.8, "few": .9, "curated": .2}[demos]
                    + {"recall": 1.4, "balanced": .9, "strict": .4}[scoring])
            return latency, loss - (.2 if (instruction, demos, scoring) == ("socratic", "curated", "strict") else 0)
        return ({"baseline": .9, "rewrite": 0, "counterexample": .35, "socratic": .6}[instruction]
                + {"none": .55, "few": .25, "curated": 0}[demos]
                + {"strict": .45, "balanced": 0, "recall": .2}[scoring]
                - (.25 if (instruction, demos, scoring) == ("rewrite", "curated", "balanced") else 0))

    study.optimize(objective, n_trials=settings["trials"], n_jobs=1)
    return study


def generate(generated_at):
    settings = {"seed": 73, "nStartupTrials": 8, "nEiCandidates": 48, "trials": 18}
    study = run_study(settings)
    return [{
        "fixture": "tpe-categorical-study.replay", "file": "tpe-categorical-study.replay.json",
        "metadata": metadata(generated_at),
        "payload": {"sampler": settings, "expected": {
            "bestValue": study.best_value, "configTrace": [trial.params for trial in study.trials],
        }},
    }]
