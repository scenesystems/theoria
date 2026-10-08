"""FM-2: _split_trials fixture generation."""

from __future__ import annotations

from typing import Any

import optuna
from optuna.samplers._tpe.sampler import _split_trials
from optuna.trial import TrialState, create_trial

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    documents = [
        {
            "fixture": "split-trials.single-and-liar",
            "file": "split-trials/single-and-liar.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    {
                        "id": "single-objective-minimize",
                        "direction": "minimize",
                        "nBelow": 2,
                        "trials": [
                            {"trialNumber": 0, "state": "complete", "value": 0.21, "intermediateValues": []},
                            {"trialNumber": 1, "state": "complete", "value": 0.74, "intermediateValues": []},
                            {
                                "trialNumber": 2,
                                "state": "pruned",
                                "value": 0.42,
                                "intermediateValues": [{"step": 0, "value": 0.9}, {"step": 1, "value": 0.42}],
                            },
                            {"trialNumber": 3, "state": "running", "liarValue": 0.5, "intermediateValues": []},
                        ],
                    },
                    {
                        "id": "single-objective-maximize",
                        "direction": "maximize",
                        "nBelow": 2,
                        "trials": [
                            {"trialNumber": 10, "state": "complete", "value": 0.2, "intermediateValues": []},
                            {"trialNumber": 11, "state": "complete", "value": 0.88, "intermediateValues": []},
                            {
                                "trialNumber": 12,
                                "state": "pruned",
                                "value": 0.69,
                                "intermediateValues": [{"step": 0, "value": 0.31}, {"step": 2, "value": 0.69}],
                            },
                            {"trialNumber": 13, "state": "running", "liarValue": 0.4, "intermediateValues": []},
                        ],
                    },
                ],
            },
        }
    ]
    for case in documents[0]["payload"]["cases"]:
        study = optuna.create_study(direction=case["direction"])
        trials = []
        for row in case["trials"]:
            trial = create_trial(
                state=TrialState[row["state"].upper()], value=row.get("value"),
                intermediate_values={report["step"]: report["value"] for report in row["intermediateValues"]},
            )
            trial.number = row["trialNumber"]
            trials.append(trial)
        below, above = _split_trials(study, trials, case["nBelow"], constraints_enabled=False)
        case["expectedBelow"] = [trial.number for trial in below]
        case["expectedAbove"] = [trial.number for trial in above]
    return documents
