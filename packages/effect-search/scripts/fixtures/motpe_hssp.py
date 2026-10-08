"""MOTPE split contracts: HSSP tie order, feasible fronts, many-objective HSSP and below weights."""

from __future__ import annotations

from typing import Any

import optuna
from optuna.samplers._tpe import sampler as tpe
from optuna.trial import create_trial

from ._common import metadata


def _study_with_values(directions, rows):
    study = optuna.create_study(directions=directions)
    trials = []
    for number, values in enumerate(rows):
        trial = create_trial(values=[float(value) for value in values])
        trial.number = number
        trials.append(trial)
    return study, trials


def _ties(generated_at: str) -> dict[str, Any]:
    cases = [
        {"id": "2d-symmetric", "directions": ["minimize"] * 2, "nBelow": 1,
         "points": [[2, 1], [1, 2]] + [[3 + i, 3 + i] for i in range(8)]},
        {"id": "3d-symmetric", "directions": ["minimize"] * 3, "nBelow": 1,
         "points": [[2, 1, 1], [1, 2, 1], [1, 1, 2]] + [[3 + i, 3 + i, 3 + i] for i in range(7)]},
        {"id": "4d-symmetric", "directions": ["minimize"] * 4, "nBelow": 2,
         "points": [[2, 1, 1, 1], [1, 2, 1, 1], [1, 1, 2, 1], [1, 1, 1, 2]] + [[3 + i] * 4 for i in range(6)]},
        {"id": "2d-maximize-symmetric", "directions": ["maximize", "minimize"], "nBelow": 2,
         "points": [[-1, 1], [-2, 2], [-3, 3], [-2, 1.5], [-5, 6], [-6, 7], [-7, 8], [-8, 9], [-9, 10], [-10, 11]]},
        {"id": "duplicates-below-unique-count", "directions": ["minimize"] * 2, "nBelow": 4,
         "points": [[1, 3], [1, 3], [3, 1], [2, 2], [2, 2]] + [[4 + i, 4 + i] for i in range(5)]},
        {"id": "duplicates-above-unique-count", "directions": ["minimize"] * 3, "nBelow": 3,
         "points": [[1, 2, 3], [3, 2, 1], [1, 2, 3], [2, 1, 3], [2, 3, 1], [3, 1, 2]]
         + [[4 + i] * 3 for i in range(4)]},
    ]
    for case in cases:
        study, trials = _study_with_values(case["directions"], case["points"])
        below, above = tpe._split_complete_trials_multi_objective(trials, study, case["nBelow"])
        case["expectedBelow"] = [trial.number for trial in below]
        case["expectedAbove"] = [trial.number for trial in above]
    return {"fixture": "motpe-hssp.ties", "file": "motpe-hssp/ties.json",
            "metadata": metadata(generated_at), "payload": {"cases": cases}}


def _constrained_study(directions, rows):
    sampler = tpe.TPESampler(seed=0, n_startup_trials=1000, constraints_func=lambda trial: (trial.params["c"],))
    study = optuna.create_study(directions=directions, sampler=sampler)
    for values, constraint in rows:
        study.enqueue_trial({"c": constraint})
        trial = study.ask()
        trial.suggest_float("c", -10.0, 10.0)
        study.tell(trial, [float(value) for value in values])
    return study


def _feasibility_fronts(generated_at: str) -> dict[str, Any]:
    cases = [
        {"id": "infeasible-dominator", "directions": ["minimize"] * 2, "nBelow": 1,
         "rows": [([1, 3], -1.0), ([2, 2], -1.0), ([3, 1], -1.0), ([1.5, 1.5], 0.5)]},
        {"id": "infeasible-first-front-3d", "directions": ["minimize", "maximize", "minimize"], "nBelow": 3,
         "rows": [([0, 9, 0], 1.0), ([1, 5, 2], -1.0), ([2, 6, 1], 0.0), ([3, 4, 3], -0.5), ([0.5, 8, 0.5], 2.0),
                  ([4, 2, 4], -2.0), ([2, 5.5, 2.5], -1.0), ([5, 1, 5], 3.0)]},
        {"id": "fill-from-least-violation", "directions": ["minimize"] * 2, "nBelow": 4,
         "rows": [([1, 1], 3.0), ([2, 4], -1.0), ([4, 2], -1.0), ([0, 0], 0.25), ([3, 3], 1.0), ([0.5, 0.5], 0.25)]},
    ]
    for case in cases:
        study = _constrained_study(case["directions"], case["rows"])
        trials = study.get_trials(deepcopy=False)
        below, above = tpe._split_trials(study, trials, case["nBelow"], True)
        case["trials"] = [{"trialNumber": trial.number, "values": trial.values,
                           "constraints": list(trial.system_attrs["constraints"])} for trial in trials]
        del case["rows"]
        case["expectedBelow"] = [trial.number for trial in below]
        case["expectedAbove"] = [trial.number for trial in above]
    return {"fixture": "motpe-hssp.feasibility-fronts", "file": "motpe-hssp/feasibility-fronts.json",
            "metadata": metadata(generated_at), "payload": {"cases": cases}}


def _lcg_points(count, dimensions, seed=12345):
    state, points = seed, []
    for _ in range(count):
        row = []
        for _ in range(dimensions):
            state = (state * 1103515245 + 12345) % 2147483648
            row.append(state / 2147483648)
        points.append(row)
    return points


def _many_objective(generated_at: str) -> dict[str, Any]:
    cases = []
    for dimensions in (2, 3, 4, 5, 6):
        directions = ["minimize"] * dimensions
        points = _lcg_points(260, dimensions)
        study, trials = _study_with_values(directions, points)
        n_below = tpe.default_gamma(len(trials))
        below, above = tpe._split_complete_trials_multi_objective(trials, study, n_below)
        cases.append({"id": f"lcg-260x{dimensions}", "directions": directions, "nBelow": n_below,
                      "points": points, "expectedBelow": [trial.number for trial in below]})
    directions = ["maximize", "minimize", "maximize", "minimize"]
    points = [[-value if direction == "maximize" else value for value, direction in zip(row, directions)]
              for row in _lcg_points(120, 4, seed=987654321)]
    study, trials = _study_with_values(directions, points)
    below, _ = tpe._split_complete_trials_multi_objective(trials, study, 17)
    cases.append({"id": "lcg-120x4-mixed-directions", "directions": directions, "nBelow": 17,
                  "points": points, "expectedBelow": [trial.number for trial in below]})
    return {"fixture": "motpe-hssp.many-objective", "file": "motpe-hssp/many-objective.json",
            "metadata": metadata(generated_at), "payload": {"cases": cases}}


def _below_weights(generated_at: str) -> dict[str, Any]:
    cases = [
        {"id": "2d-front", "directions": ["minimize"] * 2,
         "rows": [([1, 4], -1.0), ([2, 2], -1.0), ([4, 1], -1.0), ([3, 3], -1.0)]},
        {"id": "2d-with-infeasible", "directions": ["minimize", "maximize"],
         "rows": [([1, -4], -1.0), ([0.5, -5], 1.0), ([2, -2], 0.0), ([4, -1], -1.0)]},
        {"id": "3d-front", "directions": ["minimize"] * 3,
         "rows": [([1, 2, 3], -1.0), ([3, 1, 2], -1.0), ([2, 3, 1], -1.0), ([2, 2, 2], -1.0), ([3, 3, 3], -1.0)]},
        {"id": "4d-decremental", "directions": ["minimize"] * 4,
         "rows": [([1, 2, 3, 4], -1.0), ([4, 3, 2, 1], -1.0), ([2, 4, 1, 3], -1.0), ([3, 1, 4, 2], -1.0),
                  ([2.5, 2.5, 2.5, 2.5], -1.0), ([4, 4, 4, 4], -1.0)]},
        {"id": "5d-duplicates", "directions": ["minimize"] * 5,
         "rows": [([1, 2, 3, 4, 5], -1.0), ([5, 4, 3, 2, 1], -1.0), ([1, 2, 3, 4, 5], -1.0),
                  ([3, 3, 3, 3, 3], -1.0), ([2, 5, 1, 4, 3], 0.5)]},
        {"id": "single-feasible", "directions": ["minimize"] * 2,
         "rows": [([1, 2], -1.0), ([0, 0], 1.0), ([2, 1], 2.0)]},
    ]
    for case in cases:
        study = _constrained_study(case["directions"], case["rows"])
        trials = study.get_trials(deepcopy=False)
        weights = tpe._calculate_weights_below_for_multi_objective(
            study, trials, lambda trial: (trial.params["c"],))
        case["trials"] = [{"trialNumber": trial.number, "values": trial.values,
                           "constraints": list(trial.system_attrs["constraints"])} for trial in trials]
        del case["rows"]
        case["expectedWeights"] = weights.tolist()
    return {"fixture": "motpe-hssp.below-weights", "file": "motpe-hssp/below-weights.json",
            "metadata": metadata(generated_at), "payload": {"cases": cases}}


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [_ties(generated_at), _feasibility_fronts(generated_at), _many_objective(generated_at),
            _below_weights(generated_at)]
