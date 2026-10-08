"""FM-3: _get_pruned_trial_score ordering semantics fixture generation."""

from __future__ import annotations

from typing import Any

import math
import optuna
from optuna.samplers._tpe.sampler import _get_pruned_trial_score
from optuna.trial import TrialState, create_trial

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    documents = [
        {
            "fixture": "pruned-score.pruned-ordering",
            "file": "pruned-score/pruned-ordering.json",
            "metadata": metadata(generated_at),
            "payload": {
                "direction": "minimize",
                "cases": [
                    {
                        "id": "no-intermediate-values",
                        "trialNumber": 20,
                        "intermediateValues": [],
                    },
                    {
                        "id": "nan-intermediate-values",
                        "trialNumber": 21,
                        "intermediateValues": [{"step": 0, "value": "NaN"}],
                    },
                    {
                        "id": "step-tie-break",
                        "trialNumber": 22,
                        "intermediateValues": [{"step": 0, "value": 0.71}, {"step": 3, "value": 0.39}],
                    },
                ],
            },
        }
    ]
    payload = documents[0]["payload"]
    study = optuna.create_study(direction=payload["direction"])
    scores = {}
    for case in payload["cases"]:
        trial = create_trial(state=TrialState.PRUNED, intermediate_values={
            row["step"]: float(row["value"]) for row in case["intermediateValues"]
        })
        score = _get_pruned_trial_score(trial, study)
        scores[case["trialNumber"]] = score
        case["expectedStep"] = -score[0]
        case["expectedScore"] = "Infinity" if math.isinf(score[1]) else score[1]
    payload["expectedOrder"] = sorted(scores, key=scores.get)
    return documents
