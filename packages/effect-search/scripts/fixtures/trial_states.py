"""Trial-state contracts: constant-liar default, constrained PRUNED splits, threshold last step."""

from __future__ import annotations

from typing import Any

import optuna
from optuna.distributions import CategoricalDistribution, FloatDistribution
from optuna.samplers._tpe import sampler as tpe
from optuna.trial import TrialState, create_trial

from ._common import metadata

LIAR_CHOICES = ["a", "b", "c", "d"]
# Three strong early trials, then eighteen weak trials. The RUNNING reservation is "a".
LIAR_COMPLETED = list(zip("aab", [1.0, 0.99, 0.98])) + [(x, 0.1) for x in "aaabbccccccddddddd"]
LIAR_SEEDS = list(range(20))


def _liar_suggestion(seed: int, constant_liar: bool, with_running: bool) -> str:
    distributions = {"x": CategoricalDistribution(LIAR_CHOICES)}
    sampler = tpe.TPESampler(seed=seed, n_startup_trials=2, multivariate=True, constant_liar=constant_liar)
    study = optuna.create_study(direction="maximize", sampler=sampler)
    for choice, value in LIAR_COMPLETED:
        study.add_trial(create_trial(params={"x": choice}, distributions=distributions, value=value))
    if with_running:
        study._storage.create_new_trial(
            study._study_id,
            template_trial=create_trial(state=TrialState.RUNNING, params={"x": "a"}, distributions=distributions),
        )
    return study.ask(distributions).params["x"]


def _constant_liar(generated_at: str) -> dict[str, Any]:
    return {
        "fixture": "trial-states.constant-liar",
        "file": "trial-states/constant-liar.json",
        "metadata": metadata(generated_at),
        "payload": {
            "direction": "maximize",
            "choices": LIAR_CHOICES,
            "nStartupTrials": 2,
            "multivariate": True,
            "completed": [{"trialNumber": number, "x": choice, "value": value}
                          for number, (choice, value) in enumerate(LIAR_COMPLETED)],
            "running": {"trialNumber": len(LIAR_COMPLETED), "x": "a"},
            "seeds": LIAR_SEEDS,
            "expected": {
                "defaultConstantLiar": tpe.TPESampler()._constant_liar,
                "withoutRunning": [_liar_suggestion(seed, False, False) for seed in LIAR_SEEDS],
                "runningDefault": [_liar_suggestion(seed, False, True) for seed in LIAR_SEEDS],
                "runningConstantLiar": [_liar_suggestion(seed, True, True) for seed in LIAR_SEEDS],
            },
        },
    }


PRUNED_CONSTRAINT_CASES = [
    {
        # One feasible COMPLETE, nine infeasible COMPLETE, one feasible PRUNED (review S2).
        "id": "feasible-pruned-before-infeasible-complete",
        "direction": "minimize",
        "constraintParams": ["c0"],
        "trials": [{"state": "complete", "value": 0.1, "params": {"c0": -1.0}}]
        + [{"state": "complete", "value": 0.05 + index / 100, "params": {"c0": 0.5}} for index in range(9)]
        + [{"state": "pruned", "reports": [{"step": 3, "value": 0.2}], "params": {"c0": -1.0}}],
    },
    {
        # Twenty-one trials, so three below: feasible COMPLETE, then feasible PRUNED by deepest step.
        "id": "maximize-feasible-pruned-by-step",
        "direction": "maximize",
        "constraintParams": ["c0", "c1"],
        "trials": [
            {"state": "complete", "value": 0.4, "params": {"c0": -1.0, "c1": 0.0}},
            {"state": "pruned", "reports": [{"step": 1, "value": 0.7}], "params": {"c0": -0.5, "c1": -0.5}},
            {"state": "pruned", "reports": [{"step": 0, "value": 0.1}, {"step": 4, "value": 0.2}],
             "params": {"c0": 0.0, "c1": -2.0}},
            {"state": "pruned", "reports": [], "params": {"c0": -1.0, "c1": -1.0}},
        ] + [{"state": "complete", "value": 0.9 + index / 100, "params": {"c0": 0.5 + index / 10, "c1": -1.0}}
             for index in range(9)]
          + [{"state": "pruned", "reports": [{"step": 6, "value": 0.99}], "params": {"c0": 0.25, "c1": 0.25 + index / 10}}
             for index in range(8)],
    },
    {
        # Three below from one feasible COMPLETE, one feasible PRUNED, then least positive violation sum.
        "id": "least-violation-pruned-before-complete",
        "direction": "minimize",
        "constraintParams": ["c0", "c1"],
        "trials": [
            {"state": "complete", "value": 0.3, "params": {"c0": 2.0, "c1": -3.0}},
            {"state": "complete", "value": 0.8, "params": {"c0": -1.0, "c1": -1.0}},
            {"state": "pruned", "reports": [{"step": 2, "value": 0.6}], "params": {"c0": 0.1, "c1": 0.2}},
            {"state": "pruned", "reports": [{"step": 3, "value": 0.9}], "params": {"c0": -2.0, "c1": 0.0}},
            {"state": "complete", "value": 0.05, "params": {"c0": 0.25, "c1": 0.25}},
        ] + [{"state": "complete", "value": 0.01 * index, "params": {"c0": 1.0 + index, "c1": 0.5}}
             for index in range(10)]
          + [{"state": "pruned", "reports": [{"step": 9, "value": 0.0}], "params": {"c0": 0.2 + index, "c1": 0.15}}
             for index in range(6)],
    },
]


def _pruned_constraints(generated_at: str) -> dict[str, Any]:
    cases = []
    for case in PRUNED_CONSTRAINT_CASES:
        names = case["constraintParams"]
        sampler = tpe.TPESampler(
            seed=0, n_startup_trials=1000,
            constraints_func=lambda trial, names=names: tuple(trial.params[name] for name in names),
        )
        study = optuna.create_study(direction=case["direction"], sampler=sampler)
        distribution = FloatDistribution(-10.0, 10.0)
        for row in case["trials"]:
            study.enqueue_trial(row["params"])
            trial = study.ask()
            for name in names:
                trial.suggest_float(name, distribution.low, distribution.high)
            if row["state"] == "pruned":
                for report in row["reports"]:
                    trial.report(report["value"], report["step"])
                study.tell(trial, state=TrialState.PRUNED)
            else:
                study.tell(trial, row["value"])
        trials = study.get_trials(deepcopy=False)
        n_below = tpe.default_gamma(len(trials))
        below, above = tpe._split_trials(study, trials, n_below, True)
        cases.append({
            "id": case["id"],
            "direction": case["direction"],
            "constraintParams": names,
            "nBelow": n_below,
            "trials": [{
                "trialNumber": trial.number,
                "state": trial.state.name.lower(),
                "params": trial.params,
                **({"value": trial.value} if trial.state == TrialState.COMPLETE else {}),
                "reports": [{"step": step, "value": value} for step, value in trial.intermediate_values.items()],
                "constraints": list(trial.system_attrs["constraints"]),
            } for trial in trials],
            "expectedBelow": [trial.number for trial in below],
            "expectedAbove": [trial.number for trial in above],
        })
    return {
        "fixture": "trial-states.pruned-constraints",
        "file": "trial-states/pruned-constraints.json",
        "metadata": metadata(generated_at),
        "payload": {"cases": cases},
    }


THRESHOLD_CASES = [
    {"id": "late-lower-step-after-safe-step", "direction": "minimize", "limit": 1.0, "warmupSteps": 0,
     "reports": [{"step": 2, "value": 0.5}, {"step": 1, "value": 1.5}]},
    {"id": "ascending-unsafe-last-step", "direction": "minimize", "limit": 1.0, "warmupSteps": 0,
     "reports": [{"step": 1, "value": 0.5}, {"step": 2, "value": 1.5}]},
    {"id": "late-step-with-later-safe-maximum", "direction": "minimize", "limit": 1.0, "warmupSteps": 0,
     "reports": [{"step": 3, "value": 0.25}, {"step": 1, "value": 3.0}, {"step": 5, "value": 0.75},
                 {"step": 4, "value": 2.0}]},
    {"id": "maximize-late-lower-step", "direction": "maximize", "limit": 0.5, "warmupSteps": 0,
     "reports": [{"step": 4, "value": 0.75}, {"step": 2, "value": 0.25}, {"step": 6, "value": 0.25}]},
    {"id": "warmup-applies-to-last-step", "direction": "minimize", "limit": 1.0, "warmupSteps": 3,
     "reports": [{"step": 2, "value": 2.0}, {"step": 4, "value": 0.5}, {"step": 3, "value": 2.0}]},
]


def _threshold_last_step(generated_at: str) -> dict[str, Any]:
    cases = []
    for case in THRESHOLD_CASES:
        bound = {"upper": case["limit"]} if case["direction"] == "minimize" else {"lower": case["limit"]}
        pruner = optuna.pruners.ThresholdPruner(**bound, n_warmup_steps=case["warmupSteps"])
        study = optuna.create_study(direction=case["direction"], pruner=pruner)
        trial = study.ask()
        decisions = []
        for report in case["reports"]:
            trial.report(report["value"], report["step"])
            decisions.append(trial.should_prune())
        frozen = study.trials[0]
        cases.append({**case, "expectedShouldPrune": decisions, "expectedLastStep": frozen.last_step})
    return {
        "fixture": "trial-states.threshold-last-step",
        "file": "trial-states/threshold-last-step.json",
        "metadata": metadata(generated_at),
        "payload": {"cases": cases},
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [_constant_liar(generated_at), _pruned_constraints(generated_at), _threshold_last_step(generated_at)]
