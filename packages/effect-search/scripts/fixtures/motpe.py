"""MOTPE selection, weights and studies executed by Optuna."""

import sys
import numpy as np
import optuna
from optuna.samplers._tpe import sampler as tpe
from optuna.study._multi_objective import _fast_non_domination_rank
from optuna.trial import create_trial

from ._common import metadata
from .study_replay import run_study


def generate(generated_at):
    documents = []

    def document(name, file, payload):
        documents.append({"fixture": name, "file": file, "metadata": metadata(generated_at), "payload": payload})

    for suffix, directions, points in [
        ("2obj", ["minimize", "minimize"], [[1, 4], [2, 2], [3, 1], [4, 3]]),
        ("mixed-directions", ["maximize", "minimize"], [[-1, 4], [-2, 2], [-3, 1], [-4, 3]]),
        ("zero-contribution", ["minimize", "minimize"], [[1, 1], [1, 1], [1, 1]]),
    ]:
        study = optuna.create_study(directions=directions)
        for point in points:
            study.add_trial(create_trial(values=[float(value) for value in point]))
        captured = {}

        def observe(frame, event, arg):
            if event == "return" and frame.f_code is tpe._calculate_weights_below_for_multi_objective.__code__:
                captured.update(frame.f_locals)

        previous_profile = sys.getprofile()
        sys.setprofile(observe)
        try:
            weights = tpe._calculate_weights_below_for_multi_objective(study, study.trials, None)
        finally:
            sys.setprofile(previous_profile)
        signs = np.asarray([-1 if direction == "maximize" else 1 for direction in directions])
        document(f"motpe-weights.{suffix}", f"motpe-weights.{suffix}.json", {
            "directions": directions, "points": points,
            "referencePoint": (captured["ref_point"] * signs).tolist(),
            "expectedContributions": captured["contribs"].tolist(), "expectedWeights": weights.tolist(),
        })

    settings = {"seed": 29, "nStartupTrials": 6, "nEiCandidates": 48, "trials": 20}
    study = run_study(settings, multi=True)
    document("motpe-study.2obj", "motpe-study.2obj.json", {
        "sampler": settings, "directions": ["minimize", "minimize"], "expected": {
            "paretoTrialNumbers": [trial.number for trial in study.best_trials],
            "paretoValues": [trial.values for trial in study.best_trials],
            "configTrace": [trial.params for trial in study.trials],
        },
    })

    points = np.asarray([[1., 4.], [2., 2.], [3., 1.], [4., 3.]])
    ranks = _fast_non_domination_rank(points)
    trials = [create_trial(values=point) for point in points]
    for number, trial in enumerate(trials, 30):
        trial.number = number
    study = optuna.create_study(directions=["minimize", "minimize"])
    below, above = tpe._split_complete_trials_multi_objective(trials, study, 2)
    document("motpe-split.multi-rank-hssp", "motpe-split/multi-rank-hssp.json", {
        "directions": ["minimize", "minimize"], "nBelow": 2,
        "trials": [{"trialNumber": trial.number, "values": trial.values, "rank": int(rank)}
                   for trial, rank in zip(trials, ranks, strict=True)],
        "expectedBelow": [trial.number for trial in below], "expectedAbove": [trial.number for trial in above],
    })
    document("motpe-reference.reference-point", "motpe-reference/reference-point.json", {
        "epsilon": tpe.EPS,
        "cases": [{"id": name, "directions": ["minimize", "minimize"], "worstPoint": point,
                   "expectedReferencePoint": tpe._get_reference_point(np.asarray([point], dtype=float)).tolist()}
                  for name, point in [("positive", [4, 3]), ("zero", [0, 0])]],
    })
    return documents
